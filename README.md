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
