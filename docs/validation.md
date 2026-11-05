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
