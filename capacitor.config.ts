import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.donely.mobile",
  appName: "Donely",
  webDir: "dist/client",
  backgroundColor: "#afa9a6",
  ios: {
    // Render the WKWebView edge-to-edge. The web app already protects its
    // content with env(safe-area-inset-*), so "always" only exposes native
    // strips above and below the web view.
    contentInset: "never",
    backgroundColor: "#afa9a6",
  },
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
};

export default config;
