package app.donely.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Google Play In-App Review — counterpart of ReviewPrompt in the Swift bridge.
 * Automatic prompt after 10 days of active Premium, at most once per install.
 * Google owns presentation and quota, exactly like Apple on iOS.
 */
final class DonelyReview {
    private static final int REQUIRED_DAYS = 10;
    private static final String PREFS = "donely.review";
    private static final String KEY = "requested";

    private DonelyReview() { }

    static void consider(Activity activity, long subscriptionStartMs) {
        if (subscriptionStartMs <= 0 || subscriptionStartMs == Long.MAX_VALUE) return;
        long days = (System.currentTimeMillis() - subscriptionStartMs) / 86_400_000L;
        if (days < REQUIRED_DAYS) return;
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY, false)) return;
        prefs.edit().putBoolean(KEY, true).apply();
        new Handler(Looper.getMainLooper()).postDelayed(() -> requestNow(activity), 4000);
    }

    static void requestNow(Activity activity) {
        if (activity == null || activity.isFinishing()) return;
        ReviewManager manager = ReviewManagerFactory.create(activity);
        manager.requestReviewFlow().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) return;
            ReviewInfo info = task.getResult();
            manager.launchReviewFlow(activity, info);
        });
    }
}
