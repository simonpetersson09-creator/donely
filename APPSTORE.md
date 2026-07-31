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

### Bridge-kontrakt (version 1)

Kontraktsversionen exponeras som `window.__donelyBridgeVersion` (= 1) och skickas
med i `bridgeReady`. Swift bör logga/asserta att versionen är den förväntade.

**Handshake:** så snart `src/lib/premium.ts` laddats sätts
`window.__donelyBridgeReady = true` och `bridgeReady` postas till skalet. Swift
ska skicka entitlement + produkt när `bridgeReady` tas emot (och får gärna även
pusha direkt vid `didFinish navigation` – dubbla anrop är ofarliga).

**Robusthet på JS-sidan:** alla callbacks accepterar både objekt och
JSON-sträng, `trialDaysLeft` tvingas till ett icke-negativt heltal, okänd
`status` behandlas som `"failed"`, tomt/ogiltigt `displayPrice` ger
`productUnavailable`. JS har egna timeouts så UI aldrig fastnar: entitlement
8 s (låser appen), produkt 15 s (→ pris otillgängligt), köp/återställning
180 s (→ `failed`).


JS → Swift (`WKScriptMessageHandler`, `webkit.messageHandlers`):

| Handler | Payload | Swift ska göra |
| --- | --- | --- |
| `bridgeReady` | `{ version: 1 }` | Skicka entitlement + produkt till webbvyn |
| `requestEntitlement` | `{}` | Läs `Transaction.currentEntitlements` och svara med entitlement |
| `requestProduct` | `{ product: "donely.premium.monthly" }` | `Product.products(for:)` och svara med `displayPrice` |
| `purchasePremium` | `{ product: "donely.premium.monthly" }` | `product.purchase()` |
| `restorePurchase` | `{}` | `try await AppStore.sync()` + verifiera entitlement |
| `manageSubscription` | `{}` | `showManageSubscriptions(in:)` |
| `requestReview` | `{}` | `AppStore.requestReview(in:)` |

Alla sju handlers måste registreras i `WKUserContentController`, annars ignoreras
motsvarande knapp tyst.

Swift → JS (kör via `webView.evaluateJavaScript`):

```js
window.__donelySetEntitlement({ subscribed: Bool, inTrial: Bool, trialDaysLeft: Int })
window.__donelySetProduct({ id: "donely.premium.monthly", displayPrice: "29 kr" }) // eller null
window.__donelyPurchaseResult(status, message?)
```

Payload får även skickas som JSON-sträng: `__donelySetEntitlement('{"subscribed":true,…}')`.

`status` måste vara ett av:
`"success" | "cancelled" | "failed" | "productUnavailable" | "restored" | "nothingToRestore" | "pending"`.
`message` är valfritt och ska vara redan lokaliserat (t.ex. StoreKit-felbeskrivning);
utelämnas det används appens egna översättningar.

**Premium-statusar i appen** (`PremiumStatus` i `src/lib/premium.ts`):

| Status | Betyder | Mappning från entitlement |
| --- | --- | --- |
| `loading` | Inget svar från skalet ännu – knappar visar "Hämtar status…", inget beviljas | initialt |
| `trial` | Aktiv provperiod, full åtkomst | `subscribed:false, inTrial:true` |
| `subscribed` | Betalande, full åtkomst | `subscribed:true` |
| `expired` | Låst skrivning, historik/statistik läsbar | `subscribed:false, inTrial:false` |

Köpfas (`PurchasePhase`): `idle | loadingProduct | purchasing | restoring`.
`busy` är sant under köp/återställning och inaktiverar knapparna.
Läsvyer (historik, statistik, språk, inställningar, återställ köp, hantera
abonnemang) är aldrig låsta – endast `canMutate()` styr skrivning.


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

## Verifierat återställningsflöde (webbläge) – 2026-07-31

Testat i förhandsvisningen med Playwright. Resultat:

| Kontroll | Status |
| --- | --- |
| "Återställ köp" anropar `restorePurchase()` | ✅ |
| Ingen Premium-status sätts lokalt vid tryck (`vr.premium.v1` oförändrad) | ✅ |
| Webbläge använder endast dev-fallback (`LOCAL_FALLBACK_ENABLED`) | ✅ |
| `window.__donelySetEntitlement({subscribed:true,…})` → hela appen blir Premium | ✅ |
| `window.__donelySetEntitlement({subscribed:false,…})` → skrivfunktioner låses, paywall visas | ✅ |
| Alla vyer uppdateras direkt (`useSyncExternalStore`), ingen omstart | ✅ |
| Historik och statistik läsbara utan Premium | ✅ |
| Återställning med aktivt Premium → "Ditt köp har återställts" | ✅ |
| Utan prenumeration → "Inga köp att återställa" | ✅ |
| Inga lokala Premium-flaggor i produktion (fallback kompileras bort) | ✅ |

Fix i samband med kontrollen: ett entitlement som kommit via bryggan
(`bridgeControlled`) skrivs aldrig över av localStorage-fallbacken, varken av
dev-tickern eller av återställning.

### Mockat idag (endast web/dev)
- Trial-start och nedräkning från `vr.trial.v1` i localStorage.
- `purchasePremium()` sätter `vr.premium.v1` och rapporterar `success` efter 400 ms.
- `restorePurchase()` läser befintlig status och rapporterar `restored` / `nothingToRestore`.
- Pris: `FALLBACK_PRICE` ("29 kr") i stället för `product.displayPrice`.
- `openManageSubscriptions()` öppnar apps.apple.com i ny flik.

### Väntar på riktig StoreKit 2 (Swift)
- `Transaction.currentEntitlements` → `__donelySetEntitlement`.
- Trial härledd från `Transaction.offer` (introduktionserbjudande) → `inTrial` / `trialDaysLeft`.
- `Product.products(for:)` → `__donelySetProduct({ id, displayPrice })`.
- `product.purchase()` med alla utfall → `__donelyPurchaseResult(status, message?)`.
- `AppStore.sync()` för återställning.
- `showManageSubscriptions(in:)` för abonnemangshantering.
- `Transaction.updates`-lyssnare som pushar nytt entitlement när prenumerationen förnyas eller avslutas.

## Kontraktsgranskning – 2026-07-31

Verifierat i förhandsvisningen med ett simulerat iOS-skal (mockade
`webkit.messageHandlers`):

- JS postar `bridgeReady {version:1}`, `requestEntitlement {}` och
  `requestProduct {product}` direkt vid start. ✅
- Med skal närvarande ignoreras localStorage helt – `vr.premium.v1 = "1"` gav
  fortsatt låst app tills entitlement kom via bryggan. ✅
- `__donelySetEntitlement` accepterar objekt och JSON-sträng, och
  `trialDaysLeft: "3"` tolkas som 3 dagar. ✅
- `__donelySetProduct({displayPrice:"€2.99"})` slog direkt igenom i UI:t:
  "Start Premium – €2.99/mo". ✅
- Okänd status i `__donelyPurchaseResult` faller tillbaka på `failed`. ✅

Tillagt i denna granskning: versionerad handshake (`bridgeReady`,
`__donelyBridgeVersion`, `__donelyBridgeReady`), payload-validering, samt
timeouts för entitlement/produkt/köp så att UI aldrig fastnar om skalet tystnar.

**JavaScript-sidan är därmed färdig.** Återstående arbete är enbart Swift:
registrera de sju message handlers, implementera StoreKit 2-anropen och pusha
entitlement vid start, `bridgeReady`, `Transaction.updates` och när appen blir aktiv.

## 9. Veckovis påminnelse (lokala notiser, fredag 17:00 lokal tid)

JS-sidan är klar i `src/lib/notifications.ts`. Schemat uttrycks **alltid som
kalenderkomponenter** (veckodag/timme/minut) – aldrig som ett fast UTC-klockslag.

### Kontrakt JS → Swift (`webkit.messageHandlers`)
| Handler | Payload | Swift ska göra |
| --- | --- | --- |
| `requestNotificationStatus` | `{}` | `getNotificationSettings` → svara med status |
| `requestNotificationPermission` | `{}` | `requestAuthorization([.alert,.sound,.badge])` → svara med status |
| `scheduleWeeklyReminder` | `{id, weekday, hour, minute, repeats, title, body, bodyLines, language, timeZone, route}` | Se koden nedan. `body` är veckans sammanfattning (flera rader) och `route` är djuplänken (`/veckostatistik`) |
| `cancelNotification` | `{id}` | `removePendingNotificationRequests(withIdentifiers: [id])` |
| `openAppSettings` | `{}` | `UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)` |

`weekday` skickas redan i iOS-format (söndag = 1 → **fredag = 6**).

### Kontrakt Swift → JS (`evaluateJavaScript`)
```js
window.__donelySetNotificationPermission("granted" | "denied" | "notDetermined" | "provisional")
window.__donelyNotificationScheduled({ id, nextFireDate /* ISO8601 */, language })
window.__donelyNotificationError("meddelande")
window.__donelyOpenRoute("/veckostatistik")   // anropas när användaren trycker på notisen
```

**Notisinnehåll:** JS bygger titeln (`Din vecka i Donely`) och en flerradig body
med veckans aktiviteter per kategori (max 5 rader + "+ N fler kategorier") och
alltid en totalrad. Bodyn byggs om och notisen schemaläggs om varje gång en
aktivitet skapas, ändras eller tas bort, samt vid språkbyte. Swift ska sätta
`content.userInfo["route"] = payload.route` och i
`userNotificationCenter(_:didReceive:)` anropa `__donelyOpenRoute` med den rutten
så appen öppnas direkt i veckostatistiken.

### Färdig Swift-implementation
Bryggan ligger i `ios/App/App/DonelyNotificationBridge.swift` och är redan
inkopplad: `ios/App/App/DonelyViewController.swift` (satt som klass i
`Main.storyboard`) instansierar bryggan när WKWebView skapas, håller en stark
referens, registrerar alla `handlerNames` på `WKUserContentController` och sätter
`UNUserNotificationCenter.current().delegate`. Båda filerna ingår permanent i
target `App` i `App.xcodeproj`, så inget behöver läggas till manuellt efter
`git pull`. `AppDelegate` fångar kallstartstryck och skickar rutten vidare till
`__donelyOpenRoute` när webbappen laddat klart.


### Swift-implementation (kärnan)
```swift
var comps = DateComponents()
comps.weekday = payload.weekday      // 6 = fredag
comps.hour    = payload.hour         // 17
comps.minute  = payload.minute       // 0
// Ingen timeZone sätts → Calendar.current + enhetens aktuella tidszon används.
let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)

let content = UNMutableNotificationContent()
content.title = payload.title        // redan översatt av JS till valt språk
content.body  = payload.body
content.sound = .default

let request = UNNotificationRequest(identifier: payload.id, content: content, trigger: trigger)
center.removePendingNotificationRequests(withIdentifiers: [payload.id])
center.add(request)                  // samma id ⇒ ersätter, aldrig dubbletter
```

### Varför detta uppfyller kraven
- **Lokal tid/kalender:** `UNCalendarNotificationTrigger` utan explicit `timeZone`
  matchas mot `Calendar.current`, dvs. enhetens tidszon och kalender.
- **Sommar-/vintertid:** iOS räknar om nästa träff vid varje DST-övergång – 17:00
  förblir 17:00 i väggklockstid.
- **Resa/byte av tidszon:** triggern följer enheten automatiskt. JS kontrollerar
  dessutom `Intl…timeZone` vid `focus`/`visibilitychange` och schemalägger om.
- **Inga dubbletter:** stabilt id `donely.reminder.weekly.friday`; JS avbokar före
  varje ny schemaläggning och serialiserar anropen.
- **Språk:** JS skickar redan översatt `title`/`body` och schemalägger om vid
  `languageChanged`, så kommande notiser följer språket i Donely.
- **Tillstånd:** begärs först när användaren själv slår på reglaget i Inställningar,
  aldrig vid första start. Nekat läge visar förklaring + "Öppna inställningar".

### Test och loggning
- Utvecklingsknappen "Testnotis (~90 s)" (endast i dev-bygget) schemalägger
  `donely.reminder.test`.
- `logReminderDiagnostics()` loggar lokal tid, tidszon + UTC-offset, schema,
  nästa planerade notis, språk och identifierare.

### Mockat i webbversionen
- Utan iOS-skal finns ingen riktig schemaläggning: JS beräknar och visar nästa
  fredag 17:00 lokalt och använder webbens `Notification` för testnotisen medan
  fliken är öppen. All faktisk leverans sker via StoreKit-oberoende `UNUserNotificationCenter` i Swift.

## 10. Lokal datalagring – integritet, backup och migrering

All användardata lagras i appens `localStorage` (WKWebView-lagringen för
Donely-appen, dvs. inuti appens sandlåda och med i iCloud-/enhetsbackup).
`src/lib/persistence.ts` är enda skrivaren.

### Nycklar
| Nyckel | Innehåll |
| --- | --- |
| `vr.categories.v1` | Kategorier (`id`, `name`, `area`) |
| `vr.entries.v1` | Aktiviteter (`id`, `area`, `categoryId`, `categoryName`, `amount`, `createdAt`) |
| `vr.goals.v1` | Årsmål, nyckel `${år}:${kategoriId}` |
| `vr.onboarding.v1`, `vr.langGuide.v1`, `vr.reminderPrompt.v1` | Inställningsflaggor |
| `vr.lang.v1` | Valt språk |
| `vr.schemaVersion.v1` | Schemaversion (nu `1`) |
| `vr.backups.v1` | De tre senaste snapshotarna |
| `<nyckel>.writing` | Write-ahead-journal, finns bara under en pågående skrivning |
| `vr.trial.v1`, `vr.premium.v1` | Premium/dev-fallback – ingår **aldrig** i backup eller export |

### Skydd
- **Ingen automatisk nollställning.** Standardkategorier skrivs bara när
  kategorier, aktiviteter, mål, schemaversion och backuper alla saknas.
  Tom array, `null`, `undefined` eller läsfel tolkas aldrig som återställning.
- **Atomiska skrivningar.** Validering (zod) → journal → skrivning → återläsning
  → journal bort. Misslyckas något återställs de tidigare byten.
  `writeTransaction` commitar flera nycklar som en enhet med rollback.
- **Migreringar.** `MIGRATIONS` är versionsstyrd, körs en gång i stigande
  ordning, tar backup först, validerar resultatet och rullar tillbaka vid fel.
  Migreringar får aldrig radera data eller byta id.
- **Backup.** Snapshot (aktiviteter, kategorier, mål, inställningar,
  schemaVersion, timestamp) tas före migrering, import, radering av kategori,
  radering av aktivitet och "Ta bort all data". De tre senaste behålls.
- **Startvalidering.** `initializeStorage()` körs en gång i `__root`; korrupt
  data återställs från senaste giltiga backup, annars behålls de trasiga byten
  och `DataIntegrityNotice` erbjuder export eller återställning.
- **Import.** Hela filen valideras (inkl. att varje aktivitet pekar på en
  befintlig kategori), backup tas, sedan commit; fel rullas tillbaka. Premium
  ignoreras.
- **Stabila id:n.** Id genereras en gång (`crypto.randomUUID()` / prefixat
  kategori-id) och ändras aldrig vid start, import, migrering, namnbyte eller
  språkbyte.
- **Premium ≠ data.** Utgången eller overifierad premium låser bara redigering.

### Tester
`bun run test` (Vitest) – 24 tester i `src/lib/persistence.test.ts`.
