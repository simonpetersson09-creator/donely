package app.donely.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Google Play Billing half of the Donely premium bridge — the Android
 * counterpart of DonelyStoreKitBridge.swift. Same product id, same 14-day
 * local trial rule, same JS callbacks.
 */
class DonelyBilling implements PurchasesUpdatedListener {

    static final String PRODUCT_ID = "se.shiningdays.donely.premium.monthly";
    private static final int TRIAL_DAYS = 14;
    private static final long DAY_MS = 86_400_000L;
    private static final String PREFS = "donely.billing";
    private static final String TRIAL_KEY = "trial.start";

    private final Activity activity;
    private final DonelyNativePlugin plugin;
    private final BillingClient client;
    private final List<Runnable> pending = new ArrayList<>();
    private boolean connecting = false;
    @Nullable private ProductDetails product;
    @Nullable private String lastProductError;

    DonelyBilling(Activity activity, DonelyNativePlugin plugin) {
        this.activity = activity;
        this.plugin = plugin;
        this.client = BillingClient.newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        connect(null);
    }

    void onResume() {
        // Renewals, refunds and purchases made elsewhere.
        pushEntitlement();
    }

    void destroy() {
        client.endConnection();
    }

    private void connect(@Nullable Runnable then) {
        if (client.isReady()) {
            if (then != null) then.run();
            return;
        }
        if (then != null) pending.add(then);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                connecting = false;
                List<Runnable> queued = new ArrayList<>(pending);
                pending.clear();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Runnable r : queued) r.run();
                } else {
                    lastProductError = result.getDebugMessage();
                    // Without Play we can still report the local trial.
                    sendEntitlement(false, trialDaysLeft() > 0, trialDaysLeft());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting = false;
            }
        });
    }

    // ------------------------------------------------------------------ product

    void loadProduct() {
        connect(() -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()))
                .build();
            client.queryProductDetailsAsync(params, (result, detailsResult) -> {
                List<ProductDetails> list = detailsResult.getProductDetailsList();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && !list.isEmpty()) {
                    product = list.get(0);
                    lastProductError = null;
                    sendProduct(product);
                } else {
                    lastProductError = result.getDebugMessage();
                    sendProduct(null);
                }
            });
        });
    }

    /** Cheapest eligible offer first (applies an intro/free-trial offer when the user qualifies, like StoreKit). */
    @Nullable
    private static ProductDetails.SubscriptionOfferDetails bestOffer(ProductDetails details) {
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.SubscriptionOfferDetails best = null;
        long bestPrice = Long.MAX_VALUE;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
            if (phases.isEmpty()) continue;
            long price = phases.get(0).getPriceAmountMicros();
            if (price < bestPrice) {
                bestPrice = price;
                best = offer;
            }
        }
        return best;
    }

    /** Localized recurring price (last pricing phase of the base plan). */
    private static String displayPrice(ProductDetails details) {
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers == null) return "";
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (offer.getOfferId() == null) {
                List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                if (!phases.isEmpty()) return phases.get(phases.size() - 1).getFormattedPrice();
            }
        }
        ProductDetails.SubscriptionOfferDetails any = bestOffer(details);
        if (any == null) return "";
        List<ProductDetails.PricingPhase> phases = any.getPricingPhases().getPricingPhaseList();
        return phases.isEmpty() ? "" : phases.get(phases.size() - 1).getFormattedPrice();
    }

    // -------------------------------------------------------------- entitlement

    void pushEntitlement() {
        connect(() -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                boolean subscribed = false;
                long start = Long.MAX_VALUE;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Purchase p : purchases) {
                        if (!p.getProducts().contains(PRODUCT_ID)) continue;
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        subscribed = true;
                        start = Math.min(start, p.getPurchaseTime());
                        acknowledge(p);
                    }
                }
                if (subscribed) {
                    sendEntitlement(true, false, 0);
                    DonelyReview.consider(activity, start);
                } else {
                    int left = trialDaysLeft();
                    sendEntitlement(false, left > 0, left);
                }
            }));
    }

    private void acknowledge(Purchase p) {
        if (p.isAcknowledged()) return;
        client.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
            r -> { /* retried on next entitlement push if it failed */ });
    }

    private int trialDaysLeft() {
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long start = prefs.getLong(TRIAL_KEY, 0);
        if (start <= 0) {
            start = System.currentTimeMillis();
            prefs.edit().putLong(TRIAL_KEY, start).apply();
        }
        long end = start + TRIAL_DAYS * DAY_MS;
        long ms = end - System.currentTimeMillis();
        return (int) Math.max(0, Math.ceil(ms / (double) DAY_MS));
    }

    // ----------------------------------------------------------------- purchase

    void purchase() {
        connect(() -> {
            if (product == null) {
                // Try once more before giving up, like the Swift side.
                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(PRODUCT_ID)
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build()))
                    .build();
                client.queryProductDetailsAsync(params, (result, detailsResult) -> {
                    List<ProductDetails> list = detailsResult.getProductDetailsList();
                    if (!list.isEmpty()) {
                        product = list.get(0);
                        sendProduct(product);
                        activity.runOnUiThread(this::launchFlow);
                    } else {
                        sendPurchaseResult("productUnavailable", result.getDebugMessage());
                    }
                });
                return;
            }
            launchFlow();
        });
    }

    private void launchFlow() {
        ProductDetails details = product;
        if (details == null) {
            sendPurchaseResult("productUnavailable", lastProductError);
            return;
        }
        ProductDetails.SubscriptionOfferDetails offer = bestOffer(details);
        if (offer == null) {
            sendPurchaseResult("productUnavailable", null);
            return;
        }
        BillingFlowParams params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .setOfferToken(offer.getOfferToken())
                    .build()))
            .build();
        BillingResult result = client.launchBillingFlow(activity, params);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            onPurchasesUpdated(result, null);
        }
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean pendingOnly = true;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    pendingOnly = false;
                    acknowledge(p);
                }
            }
            pushEntitlement();
            sendPurchaseResult(pendingOnly ? "pending" : "success", null);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            sendPurchaseResult("cancelled", null);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            pushEntitlement();
            sendPurchaseResult("restored", null);
        } else {
            sendPurchaseResult("failed", result.getDebugMessage());
        }
    }

    void restore() {
        connect(() -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                boolean found = false;
                for (Purchase p : purchases) {
                    if (p.getProducts().contains(PRODUCT_ID)
                        && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) found = true;
                }
                pushEntitlement();
                sendPurchaseResult(found ? "restored" : "nothingToRestore", null);
            }));
    }

    void manageSubscriptions() {
        plugin.openExternal("https://play.google.com/store/account/subscriptions?sku="
            + PRODUCT_ID + "&package=" + activity.getPackageName());
    }

    // ---------------------------------------------------------------- Java → JS

    private void sendEntitlement(boolean subscribed, boolean inTrial, int trialDaysLeft) {
        try {
            JSONObject o = new JSONObject();
            o.put("subscribed", subscribed);
            o.put("inTrial", inTrial);
            o.put("trialDaysLeft", trialDaysLeft);
            plugin.evaluate("window.__donelySetEntitlement && window.__donelySetEntitlement(" + o + ")");
        } catch (Exception ignored) { }
    }

    private void sendProduct(@Nullable ProductDetails details) {
        if (details == null) {
            plugin.evaluate("window.__donelySetProduct && window.__donelySetProduct(null)");
            return;
        }
        try {
            JSONObject o = new JSONObject();
            o.put("id", details.getProductId());
            o.put("displayPrice", displayPrice(details));
            plugin.evaluate("window.__donelySetProduct && window.__donelySetProduct(" + o + ")");
        } catch (Exception ignored) { }
    }

    private void sendPurchaseResult(String status, @Nullable String message) {
        String arg = message == null || message.isEmpty() ? "" : ", " + JSONObject.quote(message);
        plugin.evaluate("window.__donelyPurchaseResult && window.__donelyPurchaseResult("
            + JSONObject.quote(status) + arg + ")");
    }
}
