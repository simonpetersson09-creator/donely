# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## iOS / Capacitor-arbetsflöde

Projektet är ett komplett Capacitor-projekt (native Xcode-projektet ligger i `ios/App` och är versionshanterat).

```sh
git pull
npm install
npm run build      # bygger web-appen och skriver dist/client/index.html (app-skalet)
npx cap sync ios   # kopierar web-assets + kör pod install
npx cap open ios   # öppnar ios/App/App.xcworkspace i Xcode
```

Detaljer:
- `capacitor.config.ts` — appId `app.donely.mobile`, appName `Donely`, `webDir: dist/client`.
- `scripts/capacitor-postbuild.mjs` körs automatiskt efter `vite build` och renderar en statisk `dist/client/index.html` (TanStack Start bygger annars bara en serverbundle). På macOS skapas `ios/App` automatiskt om det saknas.
- Appikonen ligger i `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024).
- Öppna alltid `App.xcworkspace` (inte `.xcodeproj`) — `npx cap open ios` gör det åt dig.

Felsökning: om `npx cap sync ios` klagar på `dist/client`, kör `rm -rf dist .output && npm run build` och kontrollera att både `dist/client/index.html` och `dist/server/index.mjs` skapas.

## Android / Google Play-arbetsflöde (fungerar i Windows PowerShell)

Kräver Node.js och Android Studio (inkl. Android SDK + JDK 17/21). Ingen Bash/WSL behövs.

```powershell
git pull
npm install
npm run build:native   # web-build + statiskt app-skal i dist/client
npm run android:sync   # build:native + npx cap sync android
npm run android:open   # öppnar android/ i Android Studio
npm run android:bundle # signerad AAB för Google Play
```

Signering: kopiera `android/keystore.properties.example` till `android/keystore.properties`
(git-ignorerad) och fyll i uppgifterna. Skapa en upload-nyckel en gång:
`keytool -genkeypair -v -keystore C:/Users/DU/donely-upload.jks -alias donely -keyalg RSA -keysize 2048 -validity 10000`.
AAB hamnar i `android/app/build/outputs/bundle/release/app-release.aab`.
Höj `versionCode` i `android/app/build.gradle` inför varje ny uppladdning.

- Package ID: `app.donely.mobile`. Prenumeration i Play Console: `se.shiningdays.donely.premium.monthly`.
- Play-ikon 512×512: `android/store-assets/play-icon-512.png`.
- Native kod: `android/app/src/main/java/app/donely/mobile/` (Play Billing, In-App Review, påminnelser, externa länkar).
