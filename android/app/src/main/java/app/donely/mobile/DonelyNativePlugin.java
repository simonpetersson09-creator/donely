package app.donely.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.Plugin;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Collections;

/**
 * Android half of the Donely native bridge.
 *
 * The web app talks to iOS through `window.webkit.messageHandlers.<name>` and
 * receives answers through `window.__donely*` globals. To keep the web code
 * 100 % unchanged, this plugin installs an Android-only shim with the exact
 * same handler names and answers with the exact same globals.
 *
 * `load()` runs while Capacitor registers plugins, i.e. BEFORE the first page
 * load, so the JavaScript interface and document-start shim exist from the
 * very first line of app JavaScript.
 */
@CapacitorPlugin(name = "DonelyNative")
public class DonelyNativePlugin extends Plugin {

    static final String EXTRA_ROUTE = "donely_route";

    /** Handler names mirrored from the Swift bridges (composeMail is intentionally absent → mailto fallback). */
    private static final String[] HANDLERS = {
        "bridgeReady", "requestEntitlement", "requestProduct", "purchasePremium",
        "restorePurchase", "manageSubscription", "requestReview",
        "requestNotificationStatus", "requestNotificationPermission",
        "scheduleWeeklyReminder", "cancelNotification", "openAppSettings",
    };

    private static DonelyNativePlugin instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private DonelyBilling billing;
    private DonelyReminders reminders;

    static DonelyNativePlugin get() { return instance; }

    static String shimScript() {
        StringBuilder names = new StringBuilder();
        for (int i = 0; i < HANDLERS.length; i++) {
            if (i > 0) names.append(',');
            names.append(JSONObject.quote(HANDLERS[i]));
        }
        return "(function(){try{"
            + "if(!window.DonelyAndroid||window.__donelyAndroidShim)return;window.__donelyAndroidShim=true;"
            + "var n=[" + names + "],h={};"
            + "n.forEach(function(k){h[k]={postMessage:function(v){try{window.DonelyAndroid.postMessage(k,JSON.stringify(v===undefined?{}:v))}catch(e){}}}});"
            + "window.webkit=window.webkit||{};window.webkit.messageHandlers=Object.assign(window.webkit.messageHandlers||{},h);"
            // External links: Capacitor's WebView has no multi-window support, so hand
            // http(s)/mailto/tel/market URLs to the system (browser, mail app, Play Store).
            + "var o=window.open;window.open=function(u){var s=String(u||'');"
            + "if(/^(https?:|mailto:|tel:|market:|intent:)/i.test(s)&&!/^https?:\\/\\/localhost([:\\/]|$)/i.test(s)){"
            + "try{window.DonelyAndroid.openExternal(s);return{closed:false,close:function(){}}}catch(e){}}"
            + "return o?o.apply(window,arguments):null};"
            + "}catch(e){}})();";
    }

    @Override
    public void load() {
        instance = this;
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new JsInterface(), "DonelyAndroid");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, shimScript(), Collections.singleton("*"));
        }
        // Fallback for very old WebViews without document-start scripts.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView view) { view.evaluateJavascript(shimScript(), null); }

            @Override
            public void onPageLoaded(WebView view) { view.evaluateJavascript(shimScript(), null); }
        });

        billing = new DonelyBilling(getActivity(), this);
        reminders = new DonelyReminders(getActivity(), this);

        // Cold start from a notification tap.
        handleRouteIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleRouteIntent(intent);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (billing != null) billing.onResume();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (billing != null) billing.destroy();
        if (instance == this) instance = null;
    }

    void onNotificationPermissionResult() {
        if (reminders != null) reminders.sendPermission();
    }

    private void handleRouteIntent(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(EXTRA_ROUTE);
        if (route == null || !route.startsWith("/")) return;
        intent.removeExtra(EXTRA_ROUTE);
        deliverRoute(route, 80);
    }

    /** Retries until React has installed window.__donelyOpenRoute (same as the Swift bridge). */
    private void deliverRoute(String route, int attemptsLeft) {
        main.post(() -> {
            WebView webView = getBridge().getWebView();
            webView.evaluateJavascript("typeof window.__donelyOpenRoute === 'function'", result -> {
                if ("true".equals(result)) {
                    evaluate("window.__donelyOpenRoute(" + JSONObject.quote(route) + ")");
                } else if (attemptsLeft > 0) {
                    main.postDelayed(() -> deliverRoute(route, attemptsLeft - 1), 250);
                }
            });
        });
    }

    void evaluate(String script) {
        main.post(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }

    void openExternal(String url) {
        main.post(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
            } catch (Exception ignored) {
                // No app can handle the URL — nothing sensible to do.
            }
        });
    }

    private void dispatch(String name, JSONObject body) {
        switch (name) {
            case "bridgeReady": billing.loadProduct(); billing.pushEntitlement(); break;
            case "requestEntitlement": billing.pushEntitlement(); break;
            case "requestProduct": billing.loadProduct(); break;
            case "purchasePremium": billing.purchase(); break;
            case "restorePurchase": billing.restore(); break;
            case "manageSubscription": billing.manageSubscriptions(); break;
            case "requestReview": DonelyReview.requestNow(getActivity()); break;
            case "requestNotificationStatus": reminders.sendPermission(); break;
            case "requestNotificationPermission": reminders.requestPermission(); break;
            case "scheduleWeeklyReminder": reminders.schedule(body); break;
            case "cancelNotification": reminders.cancel(body.optString("id", "")); break;
            case "openAppSettings": reminders.openAppSettings(); break;
            default: break;
        }
    }

    private class JsInterface {
        @JavascriptInterface
        public void postMessage(String name, String json) {
            JSONObject body;
            try {
                body = json == null || json.isEmpty() ? new JSONObject() : new JSONObject(json);
            } catch (Exception e) {
                body = new JSONObject();
            }
            final JSONObject payload = body;
            main.post(() -> dispatch(name, payload));
        }

        @JavascriptInterface
        public void openExternal(String url) {
            DonelyNativePlugin.this.openExternal(url);
        }
    }
}
