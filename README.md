# Donely

Bygg en iOS-app – Veckans Resultat (MVP)

Översikt

Jag vill bygga en iOS-app med fokus på vad användaren faktiskt har åstadkommit, inte vad den planerar att göra.

Appen ska vara extremt enkel att använda och göra det möjligt att registrera en aktivitet på mindre än 5 sekunder.

Det här är inte en att-göra-lista, kalender eller projektapp. Syftet är enbart att dokumentera genomförda aktiviteter.

Den första versionen ska fokusera på snabb registrering och en mycket ren användarupplevelse.

Mål

Användaren ska kunna:

välja om aktiviteten gäller Jobb eller Privat

välja kategori

ange antal

trycka på Registrera

Sedan ska aktiviteten sparas direkt och formuläret återställas så att nästa registrering kan göras omedelbart.

Hela processen ska ta mindre än fem sekunder.

Startsida

Startsidan ska vara appens huvudsida och den enda sidan som används dagligen.

Layouten ska vara mycket enkel och bestå av följande delar.

1. Val av område

Två stora knappar högst upp.

💼 Jobb

🏡 Privat

Endast ett alternativ kan vara valt åt gången.

Den valda knappen ska markeras tydligt.

2. Kategori

Under områdesvalet visas en dropdown med kategorier.

Standardkategorier

🏡 Privat

Lästa böcker

Träningspass

Armhävningar

💼 Jobb

Nya samtal

Möten

Avtal

Användaren ska kunna skapa obegränsat antal egna kategorier under både Privat och Jobb.

Egna kategorier ska sparas permanent.

3. Antal

Under kategorin visas ett numeriskt fält.

Exempel:

1

4

25

300

Endast positiva heltal ska accepteras.

4. Registrera

Längst ner på sidan visas en stor primär knapp.

Registrera

När användaren trycker på knappen ska följande sparas:

datum

tid

område (Privat eller Jobb)

kategori

antal

Efter registreringen ska:

formuläret återställas

samma område vara valt

appen vara redo för nästa registrering direkt

Ingen bekräftelsedialog ska visas.

Eventuellt kan en kort haptisk feedback eller en diskret animation användas för att visa att registreringen lyckades.

Statistik

Längst ner på startsidan ska det finnas en knapp med texten:

📊 Statistik

Knappen ska öppna en statistikvy.

Denna sida ska inte utvecklas ännu.

Bygg endast navigeringen till sidan så att statistik kan implementeras senare.

Design

Appen ska använda samma designspråk som SSPP Sign & Go så att apparna känns som en del av samma produktfamilj.

Designprinciper

modern och minimalistisk iOS-design

följer Apples Human Interface Guidelines

vit bakgrund i ljust läge

stöd för mörkt läge

stora klickytor

tydliga marginaler

rundade kort

rundade knappar

mjuka animationer

hög läsbarhet

Fokus ska ligga på enkelhet och snabbhet.

Appen ska kännas professionell och lugn.

Färger

Använd samma färgpalett som SSPP Sign & Go.

Accentfärger

💼 Jobb

diskret blå accent när vald

🏡 Privat

diskret grön accent när vald

Registrera-knappen ska använda samma guldaccent som används i Sign & Go.

Den valda knappen ska markeras tydligt medan den andra visas i ett neutralt utseende.

Tekniska krav

SwiftUI

SwiftData

iOS 18+

Offline-stöd

Förberedd för iCloud-synkronisering i framtiden

Mörkt och ljust läge

Hög prestanda

Responsiv layout för alla moderna iPhone-modeller

Viktigt

Prioritera användarupplevelsen framför funktionalitet.

Om något kan göras enklare ska den enklare lösningen väljas.

Målet är att användaren ska kunna öppna appen, registrera en aktivitet och stänga appen igen på mindre än fem sekunder.

Bygg endast denna första version. Statistik, mål, rapporter och övriga funktioner utvecklas i senare versioner.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0a0f151a-59c5-486f-b252-f12a11e42cde).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
