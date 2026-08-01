import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.donely.mobile",
  appName: "Donely",
  webDir: "dist/client",
  backgroundColor: "#afa9a6",
  ios: {
    contentInset: "always",
    backgroundColor: "#afa9a6",
  },
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
};

export default config;
