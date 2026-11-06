# Pejlo 0.8.6 – login uden ubrugt Google-kode

Komplet opdatering af 0.8.5: Firebase Auth oprettes uden popup/redirect-koden, så `apis.google.com` og iframe-tilladelsen kan udgå af CSP-testpolitikken. Se [opdatering og afprøvning](docs/version-0.8.6.md). Ingen nye nøgler kræves. Login skal afprøves på telefonen efter upload.

---

# Pejlo 0.8.5 – tydeligere alarmindstillinger

Komplet opdatering af 0.8.4: knappen hedder nu “Gem alarmindstillinger”, og tekniske CSP-rapporter vises kun i udviklerkonsollen. Testpolitikken er tilpasset den observerede Google-scriptsti. Se [opdatering](docs/version-0.8.5.md). Ingen nye nøgler kræves.

---

# Pejlo 0.8.4 – samlet pakke

Layoutforbedringerne fra den uploadede 0.8.3 er flettet ind i vores komplette 0.8.1. Alle funktioner og mailrettelser er bevaret. Se [opdateringsvejledningen](docs/version-0.8.4.md).

Upload indholdet til GitHub som hidtil. Ingen nye Cloudflare-nøgler kræves.

---

# Pejlo 0.8.1 – personlige pauser, administratorpanel og QR-parring

Komplet GitHub-pakke oven på 0.8.0. Se [opsætning og brug](docs/version-0.8.1.md).

- Pause egne beskeder i 1, 4 eller 12 timer på tværs af egne enheder. Andre brugere og alarmarkivet fortsætter.
- Driftsstatus for administratoren med seneste 20 baggrundskørsler, fejltællere og push-tilmeldinger.
- Lokalt genereret QR-kode og parringslink, som modtageren bekræfter efter login.
- Vis på kort / Pause 1 time… på notifikationer, hvor telefonen understøtter det. Pause kræver bekræftelse i appen.

Upload indholdet til GitHub som hidtil. Ingen nye nøgler kræves; tabellerne oprettes automatisk. Behold Cron Trigger hvert minut. Funktionerne skal afprøves på telefonen efter upload.

---

# Pejlo 0.8.0 – foto, søgehjælp og alarmarkiv

Komplet GitHub-pakke med alle otte ønskede tilføjelser. Se [brug og opdatering](docs/version-0.8.md). Ingen nye Cloudflare-nøgler kræves; arkivtabellen oprettes automatisk. Behold eksisterende Cron Trigger, database og nøgler.

Foto deles på profilen og vises på kortet. Find kan holde skærmen vågen og viser afstand hjemmefra samt forsigtigt vurderet bevægelsesretning. Seneste trackerkontakt er adskilt fra GPS-alder, og gamle positioner får en tydelig hjemmestatus. Kortet har valgfrie afstandscirkler og hjemmelinje. Alarmarkivet under Ture bevarer den daværende geofence i 90 dage. Mailafsenderen hedder Pejlo.

Upload hele pakkens indhold til det eksisterende repository. Telefonens faktiske skærmlås, push, foto og mail testes efter deployment.

---

# Pejlo 0.7.6 – rettet invitationsmail

Komplet udgave baseret på 0.7.5. Roller, ejerbeskeder, CSP i testtilstand og PNG-ikoner er bevaret.

- Mailafsenderen vises som **Pejlo** med den eksisterende adresse fra `MAIL_FROM`.
- Mailgrænserne kontrolleres og reserveres i ét databasekald, også ved samtidige invitationer fra forskellige brugere.
- Versionsnumre er ens i app, package.json og package-lock.json.
- Behold `MAIL_FROM` som en ren e-mailadresse, fx `pejlo@send.driftportalen.dk`. Koden tilføjer selv afsendernavnet. Ingen nye nøgler eller manuelle databasetrin kræves for denne rettelse.
- Begrænsningerne gælder invitationsforsøg, som er reserveret til afsendelse. En fejl hos mailtjenesten frigiver ikke forsøget. Døgn betyder et rullende vindue på 24 timer.

Upload hele indholdet til GitHub som hidtil. Rigtig maillevering og push på telefonen skal stadig afprøves efter deployment.

---

# Pejlo 0.7.5 – roller, sikkerhedspolitik og rigtige ikoner

- **Roller på delte profiler:** ejeren vælger ved invitation, om modtageren *kun må se* (position, historik, egne beskeder) eller også *må redigere* profil og områder. Standard i invitationsformularen er «Kun se». Ejeren kan senere skifte rolle («Gør til læser» / «Giv redigeringsret») eller fjerne adgangen. Rollen håndhæves på serveren; en læser kan ikke gemme profil, ændre områder, invitere eller slette. Eksisterende delte brugere beholder redigeringsret.
- **Ejeren får besked**, når en redaktør ændrer eller pauser områdeovervågningen («… har slået områdeovervågningen fra for Loui.»). Almindelig omdøbning giver ingen besked.
- **Content-Security-Policy i afprøvningstilstand** (Report-Only) samt `X-Frame-Options: DENY`. Se [docs/csp.md](docs/csp.md). Afvigelser vises som en kort besked i appen.
- **PNG-ikoner** (192, 512, maskable 512), `apple-touch-icon` og PNG-favicon, så installation på iPhone og Android får et rigtigt ikon.
- Databasen: tabellen over medlemmer og invitationer får en kolonne `role`. Workeren tilføjer den automatisk første gang (eksisterende medlemmer bliver «kan redigere»). Ingen manuel handling, og ingen nye nøgler.

# Pejlo 0.7.4 – tydeligere beskeder og strammere invitationsmail

- **Beskeder nævner nu profilen**, fx «Loui har forladt hjemmeområdet.» og «Batteriet på Cyklen er lavt (17 %).». Hver tracker har sit eget notifikations-tag, så beskeder fra flere trackere ikke længere erstatter hinanden. Tryk på en besked åbner appen på netop den profil (uden at genindlæse en allerede åben app).
- **Databasen:** nye migrationen `apps/api/migrations/0002_family_notifications_mail.sql` samler alle tabeller. Kør den én gang: `npx wrangler d1 migrations apply pejlo-trackers --remote` (eller indsæt filen i D1-konsollen). Workeren opretter stadig manglende tabeller som sikkerhedsnet, men nu kun én gang pr. Worker-instans i stedet for ved hvert kald.
- **Invitationsmail:** mailen oplyser, hvem der har inviteret. Grænser: 1 mail pr. minut og 10 pr. døgn pr. afsender, højst 3 pr. døgn pr. modtager. Modtagere gemmes kun som hash og slettes efter 24 timer.
- **Valgfri variabel `APP_URL`** (fx `https://pejlo.dit-domæne.dk`) bruges i invitationslinket. Uden den bruges den nuværende workers.dev-adresse.
- Ingen nye nøgler er nødvendige. Testserveren (demo3) er uændret.

# Pejlo 0.7.3 – automatisk invitationsmail

Komplet pakke med alle tidligere rettelser. Ny knap Send invitation sender mail med link og kode. Før første rigtige afsendelse skal RESEND_API_KEY og MAIL_FROM sættes op. Følg [mailvejledningen](docs/invitationsmail.md).

Denne vejledning erstatter tidligere beskrivelser af manuel invitationsafsendelse.

# Pejlo 0.7.2 – placering af invitationsfelt

Invitationskoden kan nu kun indtastes under Indstillinger eller på velkomstsiden for nye konti. Feltet vises ikke længere under Kort, Ture eller Find. Invitationer sendes fortsat manuelt. Dagens kortrute følger dansk midnat; tidligere dage findes under Ture, afhængigt af Traccars opbevaring. Komplet pakke, ingen nye indstillinger.

# Pejlo 0.7.1 – rettet sletning af geofence

Slettede områder vises ikke længere på kortet. Ny tegning starter uden det tidligere omrids. Tegneknappen kræver mindst tre gyldige punkter. Alle funktioner fra 0.7.0 er med. Upload hele pakken som hidtil; ingen nye indstillinger kræves.

# Pejlo 0.7.0

Komplet GitHub-udgave med personlige alarmvalg, familiedeling af samme tracker/profil/geofences og historik med danske døgn, datovalg, afspilning og synlige huller.

**Start her:** [Opsætning og brug af 0.7.0](docs/version-0.7.md). Der kræves ingen nye Cloudflare-nøgler eller Firebase-regler. Behold jeres eksisterende database, pushnøgler og buildopsætning.

`npm test` bygger appen og kører tests. `npm run build` danner `dist`; `npx wrangler deploy` deployer den eksisterende Worker. `MAPTILER_API_KEY` skal fortsat være tilgængelig ved build.

Nedenstående dokumentation beskriver også tidligere trin i projektet; 0.7.0-vejledningen er gældende ved forskelle.

---

# Nyt i 0.6.1
Navngivne geofences, skift og sletning; margen 0–30 m, standard 5 m. Genbrug Cloudflare-opsætningen. Gem området igen for at opdatere serverens margen.

# Nyt i 0.6.0
Cirkel eller område tegnet med punkter direkte i Pejlo. Push ved udgang og tilbagekomst er implementeret og kræver tre runtime-værdier én gang i Cloudflare. Se [opsætning og test](docs/geofence.md).

# Pejlo 0.5.1

Dansk tracker-app med Firebase-login, private profiler, fælles kort og Traccar-testforbindelse. Brugeren tilknytter en klargjort tracker med ID og parringskode i appen. Læs **START_HER.md før upload**: et D1-database-ID samt to runtime-secrets skal sættes én gang.

## Kørsel

```sh
npm test
npm run build
npx wrangler dev
```

Cloudflare Build: `npm run build`. Deploy: `npx wrangler deploy`.

## Struktur

- `apps/web`: brugerflade, login, profiler, kort og polling.
- `apps/api/worker.js`: verificerer Firebase-login via Google, autoriserer via D1 og kontakter Traccar.
- `apps/api/migrations`: trackerregister med ét ejerskab pr. ID og hash af parringskode.
- `packages/shared`: geografiske beregninger.
- `tests`: adgang, ejerskab, koder, GPS-validering, kontoskift, profiler og kortopsætning.

`TRACCAR_TOKEN` og `TRACCAR_ADMIN_UID` sættes som runtime-secrets. `MAPTILER_API_KEY` er den offentlige, domænebegrænsede kortnøgle under Builds. Ingen bruger skal oprette sin egen kortnøgle eller Traccar-konto.

Testserveren er låst til `https://demo3.traccar.org`. Denne udgave kræver ingen ny server. Trackerens protokol og mobilnet skal passe til testserveren.
