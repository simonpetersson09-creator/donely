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

## StoreKit 2 – vad som återstår i Swift

Webbdelen är nu helt förberedd. All Premium-status läses från `src/lib/premium.ts`,
som aldrig beviljar åtkomst själv i produktionsbygget.

### Env-flagga

`VITE_ALLOW_LOCAL_PREMIUM=true` aktiverar localStorage-fallbacken (provperiod och
"köp" simuleras lokalt). Den är automatiskt på i `import.meta.env.DEV` och
**måste vara avstängd i produktionsbygget** – utan iOS-skal är appen då låst.

### Bridge-kontrakt

JS → Swift (`WKScriptMessageHandler`, `webkit.messageHandlers`):

| Handler | Payload | Swift ska göra |
| --- | --- | --- |
| `requestEntitlement` | `{}` | Läs `Transaction.currentEntitlements` och svara med entitlement |
| `requestProduct` | `{ product: "donely.premium.monthly" }` | `Product.products(for:)` och svara med `displayPrice` |
| `purchasePremium` | `{ product: "donely.premium.monthly" }` | `product.purchase()` |
| `restorePurchase` | `{}` | `try await AppStore.sync()` + verifiera entitlement |
| `manageSubscription` | `{}` | `showManageSubscriptions(in:)` |
| `requestReview` | `{}` | `AppStore.requestReview(in:)` |

Swift → JS (kör via `webView.evaluateJavaScript`):

```js
window.__donelySetEntitlement({ subscribed: Bool, inTrial: Bool, trialDaysLeft: Int })
window.__donelySetProduct({ id: "donely.premium.monthly", displayPrice: "29 kr" }) // eller null
window.__donelyPurchaseResult(status, message?)
```

`status` måste vara ett av:
`"success" | "cancelled" | "failed" | "productUnavailable" | "restored" | "nothingToRestore" | "pending"`.
`message` är valfritt och ska vara redan lokaliserat (t.ex. StoreKit-felbeskrivning);
utelämnas det används appens egna översättningar.

### Krav på Swift-implementationen

1. **Provperioden får aldrig startas av appen.** `inTrial` ska härledas från
   `Product.SubscriptionInfo.Status` / `RenewalInfo` respektive
   `Transaction.offer` (introductory offer, 7 dagar) – inte från något lokalt datum.
2. `trialDaysLeft` beräknas från transaktionens `expirationDate`.
3. Skicka entitlement vid appstart, vid `requestEntitlement`, vid
   `Transaction.updates` och när appen blir aktiv igen.
4. Skicka `pending` för `.pending` (Ask to Buy) och `cancelled` för `.userCancelled`.
5. Verifiera alltid `VerificationResult` innan entitlement rapporteras.
6. Konfigurera produkten `donely.premium.monthly` i App Store Connect med ett
   7-dagars introduktionserbjudande (gratis provperiod).
7. Priset i UI kommer enbart från `displayPrice` – inga hårdkodade belopp.
