# Pejlo 0.8.5

Komplet pakke med alle funktioner fra 0.8.4.

- “Gem mine beskeder” hedder nu “Gem alarmindstillinger”. Knappen gemmer fortsat kontoens personlige alarmvalg for den valgte tracker.
- Tekniske CSP-testbeskeder vises ikke længere som pop op i appen. Diagnostik findes kun i udviklerkonsollen, højst fem forskellige rapporter pr. indlæsning, og uden fulde adresser eller URL-parametre.
- Testpolitikken genkender nu Googles scriptstier `/js/` og `/_/scs/abc-static/` på `apis.google.com`, herunder stien fra brugerens screenshot. Der er ikke tilføjet generelle jokertegn eller inline-script-tilladelser. Politikken er fortsat Report-Only.

Upload pakkens indhold til det eksisterende GitHub-repository. Ingen nye Cloudflare-nøgler eller databasetrin kræves. Genåbn PWA'en efter deployment og kontrollér version 0.8.5, den nye knaptekst og at den tekniske besked ikke dækker bundmenuen.

Lokale tests kan ikke bekræfte alle rapporter fra en virkelig Firebase-session på iPhone. Login på telefonen skal afprøves efter upload.
