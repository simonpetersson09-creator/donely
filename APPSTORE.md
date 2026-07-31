# Donely – App Store-förberedelser

## 1. Dataskydd (klart)
- All data (kategorier, registreringar, antal, årsmål, språk, premiumstatus) lagras **enbart i localStorage på enheten**.
- Ingen backend, inga konton, inga nätverksanrop med användardata → användare kan aldrig se varandras data.
- Integritetspolicy finns på `/integritet` (länkad längst ned i Inställningar). Ange den URL:en i App Store Connect under "Privacy Policy URL".
- App Privacy-formuläret i App Store Connect: välj **"Data Not Collected"**.

## 2. Ikoner och manifest (klart)
- `public/app-icon-1024.png` – App Store-ikon (1024×1024, ingen transparens, inga rundade hörn).
- `public/icon-512.png`, `icon-192.png`, `icon-180.png` (apple-touch-icon), `favicon.png`.
- `public/manifest.webmanifest` – standalone, portrait, temafärg `#1b3a5c`.
- Meta-taggar för hemskärm/statusfält finns i `src/routes/__root.tsx`.

## 3. Paketera som iOS-app (Capacitor)
Kör lokalt på en Mac med Xcode 16+:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Donely app.donely.mobile --web-dir=dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.donely.mobile',
  appName: 'Donely',
  webDir: 'dist',
  ios: { contentInset: 'always', backgroundColor: '#ffffff' },
};
export default config;
```

I Xcode: sätt Display Name "Donely", Deployment Target iOS 15+, lägg in ikonen 1024×1024 i Assets, och stöd endast Portrait.

## 4. Prenumeration (StoreKit 2)
Appen anropar redan en iOS-brygga i `src/lib/premium.ts`:
- `purchasePremium` – starta köp
- `restorePurchase` – återställ köp
- `openManageSubscriptions` – Apples hanteringssida

I App Store Connect: skapa en auto-förnyande prenumeration, 29 kr/månad, med **7 dagars gratis introduktionserbjudande**. Product ID förslag: `app.donely.premium.monthly`.
I iOS-skalet: implementera `WKScriptMessageHandler` för namnen ovan och skicka tillbaka entitlement-status till webbvyn.

## 5. Checklista före inlämning
- [ ] Apple Developer Program-medlemskap
- [ ] Bundle ID registrerat (`app.donely.mobile`)
- [ ] Skärmbilder: 6,9" och 6,5" iPhone
- [ ] Beskrivning, nyckelord, supportlänk, integritetspolicy-URL
- [ ] Åldersgräns 4+
- [ ] Testa köpflödet i Sandbox
