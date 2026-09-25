package app.donely.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * Local reminders — Android counterpart of DonelyNotificationBridge.swift.
 * Payloads come fully localized from JavaScript and are stored so they can be
 * re-armed after a reboot or app update.
 */
class DonelyReminders {

    static final String CHANNEL_ID = "donely_reminders";
    static final int PERMISSION_REQUEST = 4711;
    private static final String PREFS = "donely.reminders";
    private static final String ASKED_KEY = "__asked";
    private static final String DEFAULT_ROUTE = "/summary/week";

    private final Activity activity;
    private final DonelyNativePlugin plugin;

    DonelyReminders(Activity activity, DonelyNativePlugin plugin) {
        this.activity = activity;
        this.plugin = plugin;
        ensureChannel(activity);
    }

    // ------------------------------------------------------------ permissions

    void sendPermission() {
        String value;
        if (NotificationManagerCompat.from(activity).areNotificationsEnabled()) {
            value = "granted";
        } else if (Build.VERSION.SDK_INT >= 33 && !prefs(activity).getBoolean(ASKED_KEY, false)) {
            value = "notDetermined";
        } else {
            value = "denied";
        }
        plugin.evaluate("window.__donelySetNotificationPermission && window.__donelySetNotificationPermission("
            + JSONObject.quote(value) + ")");
    }

    void requestPermission() {
        if (Build.VERSION.SDK_INT < 33
            || ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED
            || prefs(activity).getBoolean(ASKED_KEY, false)
                && !ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.POST_NOTIFICATIONS)) {
            sendPermission();
            return;
        }
        prefs(activity).edit().putBoolean(ASKED_KEY, true).apply();
        ActivityCompat.requestPermissions(activity,
            new String[] { Manifest.permission.POST_NOTIFICATIONS }, PERMISSION_REQUEST);
    }

    void openAppSettings() {
        Intent intent;
        if (Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + activity.getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { activity.startActivity(intent); } catch (Exception ignored) { }
    }

    // ------------------------------------------------------------- scheduling

    void schedule(JSONObject payload) {
        String id = payload.optString("id", "");
        if (id.isEmpty()) {
            sendError("Invalid scheduleWeeklyReminder payload");
            return;
        }
        prefs(activity).edit().putString(id, payload.toString()).apply();
        long next = arm(activity, payload);
        try {
            JSONObject o = new JSONObject();
            o.put("id", id);
            if (next > 0) o.put("nextFireDate", iso(next));
            if (payload.has("language")) o.put("language", payload.optString("language"));
            plugin.evaluate("window.__donelyNotificationScheduled && window.__donelyNotificationScheduled(" + o + ")");
        } catch (Exception e) {
            sendError(e.getMessage() == null ? "schedule failed" : e.getMessage());
        }
    }

    void cancel(String id) {
        if (id.isEmpty()) return;
        prefs(activity).edit().remove(id).apply();
        AlarmManager am = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(activity, id));
        NotificationManagerCompat.from(activity).cancel(id.hashCode());
    }

    private void sendError(String message) {
        plugin.evaluate("window.__donelyNotificationError && window.__donelyNotificationError("
            + JSONObject.quote(message) + ")");
    }

    // ------------------------------------------------------ static helpers

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Re-arms every stored reminder (boot / app update). */
    static void rearmAll(Context ctx) {
        for (Map.Entry<String, ?> e : prefs(ctx).getAll().entrySet()) {
            if (ASKED_KEY.equals(e.getKey()) || !(e.getValue() instanceof String)) continue;
            try { arm(ctx, new JSONObject((String) e.getValue())); } catch (Exception ignored) { }
        }
    }

    /** Next local time matching weekday (Sunday = 1, same as iOS) + hour:minute. */
    static long nextFire(JSONObject p) {
        Calendar now = Calendar.getInstance();
        Calendar c = (Calendar) now.clone();
        c.set(Calendar.HOUR_OF_DAY, p.optInt("hour", 17));
        c.set(Calendar.MINUTE, p.optInt("minute", 0));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        int weekday = p.optInt("weekday", 6);
        int diff = (weekday - c.get(Calendar.DAY_OF_WEEK) + 7) % 7;
        c.add(Calendar.DAY_OF_MONTH, diff);
        if (!c.after(now)) c.add(Calendar.DAY_OF_MONTH, 7);
        return c.getTimeInMillis();
    }

    static long arm(Context ctx, JSONObject payload) {
        String id = payload.optString("id", "");
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null || id.isEmpty()) return 0;
        long at = nextFire(payload);
        // Inexact alarm: no SCHEDULE_EXACT_ALARM permission needed. A weekly
        // summary may arrive a few minutes late under Doze, which is fine.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx, id));
        return at;
    }

    static PendingIntent pending(Context ctx, String id) {
        Intent intent = new Intent(ctx, DonelyReminderReceiver.class)
            .setAction("app.donely.mobile.REMINDER")
            .putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID,
            ctx.getString(R.string.reminder_channel_name), NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(ch);
    }

    /** Shows the stored reminder and re-arms it for next week when repeating. */
    static void fire(Context ctx, String id) {
        String raw = prefs(ctx).getString(id, null);
        if (raw == null) return;
        JSONObject p;
        try { p = new JSONObject(raw); } catch (Exception e) { return; }

        ensureChannel(ctx);
        String body;
        JSONArray lines = p.optJSONArray("bodyLines");
        if (lines != null && lines.length() > 0) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < lines.length(); i++) {
                if (i > 0) sb.append('\n');
                sb.append(lines.optString(i));
            }
            body = sb.toString();
        } else {
            body = p.optString("body", "").replace("\\n", "\n");
        }
        String subtitle = p.optString("subtitle", "");
        String route = p.optString("route", DEFAULT_ROUTE);
        if (route.isEmpty()) route = DEFAULT_ROUTE;
        if (!route.contains("?")) {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            route = route + "?date=" + f.format(new Date());
        }

        Intent open = new Intent(ctx, MainActivity.class)
            .putExtra(DonelyNativePlugin.EXTRA_ROUTE, route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, id.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_donely)
            .setContentTitle(p.optString("title", "Donely"))
            .setContentText(subtitle.isEmpty() ? body : subtitle)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(subtitle.isEmpty() ? body : subtitle + "\n" + body))
            .setAutoCancel(true)
            .setContentIntent(content)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        boolean allowed = Build.VERSION.SDK_INT < 33
            || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        if (allowed) {
            try { NotificationManagerCompat.from(ctx).notify(id.hashCode(), b.build()); }
            catch (SecurityException ignored) { }
        }

        if (p.optBoolean("repeats", true)) arm(ctx, p);
        else prefs(ctx).edit().remove(id).apply();
    }

    private static String iso(long ms) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ms));
    }
}
