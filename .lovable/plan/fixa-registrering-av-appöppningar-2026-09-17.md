# Fixa registrering av appöppningar

## Ändring
- Identifiera den installerade iPhone-appen via Capacitors officiella gränssnitt i stället för ett osäkert globalt webbläsarobjekt.
- Spara sex-timmarsspärren först efter att databasen har bekräftat registreringen.
- Låt misslyckade försök kunna skickas igen vid nästa öppning i stället för att tyst blockeras.

## Kontroll
- Verifiera att projektet bygger utan fel.
- Kontrollera att databasen fortfarande är tom före en ny iPhone-version; ändringen kräver en ny iOS-build för att nå telefonen.
