package app.donely.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires stored reminders and re-arms them after reboot / app update. */
public class DonelyReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            DonelyReminders.rearmAll(context);
            return;
        }
        String id = intent.getStringExtra("id");
        if (id != null) DonelyReminders.fire(context, id);
    }
}
