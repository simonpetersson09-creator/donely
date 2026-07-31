import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.donely.mobile",
  appName: "Donely",
  webDir: "dist/client",
  ios: {
    contentInset: "always",
  },
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
};

export default config;
