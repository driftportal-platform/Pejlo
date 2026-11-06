# Kontrol af Pejlo 0.8.5

89 automatiske tests består inklusive build. Nye tests kontrollerer den tydelige knaptekst og at CSP-rapporter kun logges i konsollen, uden URL-parametre og med deduplikering. Sikkerhedspolitikken er fortsat i testtilstand. Ingen live Firebase-/iPhone-test eller deployment udført.

---

# Kontrol af Pejlo 0.8.4

87 tests består inklusive build. Derudover er det flettede appforløb kørt med simuleret login og syntetiske HTTP-svar: Område-genvej, gammel hjemmestatus, foto i profilvælger, kompakt historik sammen med alarmarkiv samt lukning/tømning af profilvælger ved logout. Serverkoden og alle tidligere funktioner fra 0.8.1 er bevaret.

Ingen deployment eller live mail/push afsendt. Der er ikke udført fuld visuel mobilbrowserkontrol eller Wrangler dry-run. Den lokale DOM-kontrol erstatter ikke test på telefonen.

---

# Kontrol af Pejlo 0.8.1

- 85 automatiske tests bestået, inklusive build. Nye tests dækker personlige pauser, varighed, genoptagelse, adgang for læsere, afvisning af uvedkommende, arkivering under pause og undertrykkelse af allerede kølagte beskeder samt sene svar efter profilskift/logout.
- Administrator-API testes med både administrator og almindelig bruger. Baggrundskørslens succes, Traccar-fejl og opbevaring af højst 20 kørsler er kontrolleret. Svarene indeholder ingen abonnementsadresser, nøgler eller rå fejltekster.
- Parringslinks testes for gyldighed, fremmede domæner og placering af koden i fragmentet. Service workeren testes med og uden handlingsknapper, åbning af rigtig profil og pausebekræftelse.
- Simulerede DOM-forløb for ejer og delt bruger består, også pause/genoptagelse. Ejerforløbet omfatter administratorstatus, oprettelse af QR/link, åbning af link, afvisning af udskiftning af eksisterende tracker samt tilknytning til en ny tom profil.
- QR-generatorens matrix er genereret og læst tilbage med en separat QR-dekoder, både med almindeligt og maksimalt langt tracker-ID. SVG-udgaven oprettes i DOM-kontrollen. Det erstatter ikke scanning med telefonens kamera.
- Tidligere 0.8.0-funktioner og tests er bevaret.

Ingen deployment, live mail eller rigtig push afsendt herfra. Konti, HTTP-svar og databasetests er lokale/syntetiske. Ingen fuld visuel mobilbrowserkontrol eller Wrangler dry-run i denne omgang. Telefonens konkrete notifikationsknapper og QR-scanning skal afprøves efter upload.

---

# Kontrol af Pejlo 0.8.0

- `npm test`: 78 tests bestået. Produktionsfilerne bygges som del af testen.
- Nye kontroller: gammel/frisk hjemmestatus, bevægelsesretning og afvisning af drift/dårlig præcision/huller, fotovalidering, skærmlåsens synlighed og sene svar efter stop, adskilte GPS-/kontakt-tider samt valgfrie kortlag.
- Alarmarkiv afprøvet med rigtig lokal SQLite: uændret område efter geofenceændring, personafgrænsning, stabil paginering ved identiske tidspunkter og 90-dagesgrænse. Cron registrerer områdehændelser uden VAPID-nøgler; API afviser uvedkommende.
- Samtidige mailreservationer kan ikke overskride kvoterne. Afsendernavnet Pejlo kontrolleres i mailtesten.
- Simulerede DOM-forløb for ejer og delt redaktør: login, profil, alarmvalg, historik, arkiv, invitation/join og delt redigering. Ingen rigtige invitationer afsendt; HTTP-svar og konti er syntetiske.
- Tidligere tests af roller, kontoadskillelse, API-adgang, sletning af geofence, navigation, kort og PWA-ikoner består.

## Praktisk kontrol efter upload

Ikke deployet til brugerens Cloudflare herfra. Der er ikke kørt Wrangler dry-run eller fuld visuel mobilbrowserkontrol i denne omgang. Fysisk tracker, live Firebase, push/mail-levering, telefonens skærmlås og canvasbehandling af et rigtigt foto skal afprøves efter upload. De lokale tests bekræfter ikke disse telefon- og tjenesteafhængige forhold.

Se [opdateringsvejledningen](version-0.8.md) for den korte accepttest og funktionernes grænser.

---

## Tidligere kontrolnoter

# Kontrol af Pejlo 0.5.1

## Udført

- Node 24: `npm test`, 29 tests bestået. Bygningen køres som del af testen.
- API: manglende/ugyldigt login, ubekræftet e-mail, manglende register, anden konto, metoder/origins, korrekt devicefilter, ingen læk af rå felter/secret, ugyldig GPS, historikfejl, ejerskab og forkert parringskode.
- Provisionering: kun administrator, ingen overskrivning af eksisterende ID, oprettelse af ny enhed, tilfældig kode og kun hash i register.
- Klient: sene svar efter logout ignoreres, API-fejl bliver ikke til eksempelpositioner, tilknytning bevares i profilnormalisering.
- Eksisterende tests for private profiler, revisioner, kontoskift, migration, geografi og fælles kort består fortsat.
- Migrationen og den betingede UPDATE ... RETURNING er afprøvet mod en rigtig lokal SQLite-database: første ejer kan claim'e, anden ejer kan ikke overtage.
- Browserkontrol i særskilt lokal testkopi med tydeligt syntetiske svar: ID/kode-formularen binder til profilen; offline med 15 minutter gammel position viser alder og korrekt batteri; manglende position viser ingen målmarkør, ingen opdigtet batteriprocent og deaktiveret Find-knap. Visuelt desktoplayout kontrolleret. Browserens udvidelseslog gav støj; ingen observerede appfejl.
- Source/ZIP indeholder ingen Traccar-token eller rigtig parringskode. Testkoder i testfiler er kun fixtures.

## Ikke udført endnu

Ingen deployment til brugerens Cloudflare, ingen rigtig D1-binding/migration i brugerens konto og ingen ende-til-ende-test med fysisk tracker, Firebase-login eller Traccar-token. Den lokale browserkontrol bruger ikke brugerens konto og bekræfter ikke live data. Der er ikke gennemført en separat mobilbrowserkontrol af denne ændring.

Der er ikke kørt Wrangler dry-run i dette miljø; Worker-koden er syntakskontrolleret og API-handleren testet med kontrollerede HTTP/D1-svar. API-integration og D1-bindings skal derfor også verificeres efter opsætning. Kortnøgle er ikke indbygget lokalt; Cloudflares eksisterende buildvariabel skal bevares.

## Accepttest efter opsætning

1. Deploy med rigtig D1-ID og to runtime-secrets.
2. Log på administratorkontoen, opret parringskode til testtrackerens ID.
3. Log på som tiltænkt ejer, tilføj ID/kode, kontrollér at den knyttes til profilen.
4. Kontrollér rigtig position og tidspunkt mod Traccar. Testen er først godkendt, når den fysiske enhed har sendt en ny position.
5. Kontrollér med anden konto, at samme ID/kode ikke kan overtages, og at egne trackerlist er tomme.
6. Afprøv uden GPS, offline og efter logout/login. Bekræft at livepositioner ikke erstattes af demo.

## Afgrænsning

Testserver, ikke en produktionsklar tjeneste med SLA. Positionshistorik er indeværende UTC-dag, højst 2000 punkter; kortets linje er kun forbindelsen mellem punkter. Ingen familiedeling, ejeroverdragelse eller UI til gendannelse af mistede parringskoder. Hardwareopsætning kan ikke udføres alene ved at registrere ID i en webapp.

## Rettelse i 0.5.1

Begge udgående kald bruger nu Cloudflare-understøttet redirect manual. Tests efterligner runtime-begrænsningen og afviser redirect error. Yderligere tests bekræfter, at en HTTP-viderestilling fra Google/Traccar ikke følges, og at credentials derfor ikke sendes videre. Database-ID fra brugerens screenshot er indsat; eksisterende tabel og indeks skal ikke genoprettes. 31 tests består. Livekontrol efter brugerens nye deploy afventes fortsat.


## 0.8.6

Tilføjet: `tests/auth-init.test.mjs` (login oprettes uden popup/redirect-resolver) og skærpede CSP-kontroller (ingen `apis.google.com`, `frame-src 'none'`). Login med rigtig Firebase-session kan ikke afprøves automatisk og skal tjekkes på telefonen.
