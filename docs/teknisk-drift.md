# Tjenester og ansvar

Pejlo teknisk driftsvejledning. Version 0.8.51, opdateret 19. november 2026. Ansvarlig: Stefan Brun Bjerg.

Denne vejledning samler installationen og viser, hvor indstillinger ændres ved ny IP eller serverskift. Adresser og værdier nedenfor er den registrerede opsætning. Felter med UDFYLD er til din private kopi. Udgivelse af 0.8.51 og et vellykket Google-mobilopslag skal bekræftes i drift.

| Tjeneste | Opgave i Pejlo | Registreret status |
| --- | --- | --- |
| GitHub | Kildekode og dokumentation | driftportal-platform/Pejlo |
| Cloudflare Workers | App, API og baggrundsalarmer | Worker: pejlo |
| Cloudflare D1 | Trackere, rettigheder, alarmer og aftaler | pejlo-trackers; binding DB |
| Firebase Authentication | Login og bekræftet e-mail | Projekt pejlo-a1fed |
| Cloud Firestore | Brugerens profiler og synkronisering | Samme Google-projekt |
| Traccar på Windows | Modtager JT808 og gemmer historik | Egen server med H2-database |
| Caddy | Offentlig HTTPS foran Traccar | Windows-tjeneste PejloCaddy |
| DuckDNS | DNS-navn til skiftende offentlig IP | pejlo.duckdns.org |
| MapTiler og Leaflet | Kortfliser og kortvisning | Fælles nøgle; satellit som standard |
| Google Geolocation API | Omtrentlig mobil-/Wi-Fi-position | Konfigureret; rigtigt opslag afventer test |
| Resend | Invitationsmails | Nøgle og afsender registreret i Cloudflare |
| Web Push | Beskeder til telefonen | VAPID i Cloudflare; kræver enhedstilmelding |
| Stripe og forbrugsmåling | Betaling og måling af cloudforbrug | Understøttet i kode; aktivering kontrolleres særskilt |

Trackeren sender til Traccar på TCP 5015. Pejlos API læser Traccar via HTTPS 443. Browseren får ikke Traccars token. Google-opslag sendes fra Traccar-pc’en; MapTiler-kortfliser hentes af browseren.


# Cloudflare og GitHub

App: https://pejlo.driftportal-platform.workers.dev • Systemadmin: https://pejlo.driftportal-platform.workers.dev/admin/

Cloudflare → Workers & Pages → pejlo. Runtime-indstillinger findes under Settings → Variables and Secrets i Production. Kortnøglen ligger særskilt i Builds. Eksisterende værdier skal bevares ved dokumentationsupload.

| Navn | Type og placering | Funktion |
| --- | --- | --- |
| TRACCAR_URL | Runtime Variable | Fallback: https://demo3.traccar.org i kildekoden. |
| TRACCAR_TOKEN | Runtime Secret | Token til fallback-serveren; fra samme Traccar-konto. |
| TRACCAR_CONFIG_SECRET | Runtime Secret | Mindst 32 tilfældige tegn. Åbner det krypterede servervalg i D1. |
| TRACCAR_ADMIN_UID | Runtime Secret | Firebase UID for Pejlos systemadmin; ikke e-mail. |
| GCP_FIREBASE_AUTH_SERVICE_ACCOUNT | Runtime Secret | Hele JSON-nøglen til administration af kunder. |
| RESEND_API_KEY | Runtime Secret | Adgang til Resend. |
| MAIL_FROM | Runtime Variable | pejlo@send.driftportalen.dk |
| VAPID_PRIVATE_KEY | Runtime Secret | Privat pushnøgle. |
| VAPID_PUBLIC_KEY | Runtime Variable | Offentlig pushnøgle. |
| VAPID_SUBJECT | Runtime Variable | mailto:Driftportal.platform@gmail.com |
| APP_URL | Valgfri Runtime Variable | Appens offentlige adresse til invitationslink. |
| MAPTILER_API_KEY | Build Variable eller Secret | Selve kortnøglen; indbygges som offentlig webkonfiguration. |

D1: database-id 88356335-2caf-41d5-9a45-99c31eaea836. Binding DB i wrangler.jsonc. Cron Trigger: * * * * * (hvert minut). Build: npm run build. Deploy: npx wrangler deploy. Node-krav i pakken: mindst version 20.

Et aktiveret servervalg i Pejlos admin har forrang for TRACCAR_URL og TRACCAR_TOKEN. Du skifter derfor server i admin. Behold TRACCAR_CONFIG_SECRET uændret ved normal flytning; den er nødvendig sammen med D1-backuppen.


# Google Cloud og Firebase

Projekt-id: pejlo-a1fed. Firebase authDomain: pejlo-a1fed.firebaseapp.com. Webapp-id: 1:193924010631:web:6219461759065a0113de22. Webkonfiguration findes i apps/web/src/config/firebase.js.

## Login og profildata

- Firebase Authentication bruges til e-mail og adgangskode. Brugeren skal bekræfte sin e-mail. Bevar appens domæne i Authentication → Settings → Authorized domains.
- Cloud Firestore gemmer users/{uid}/private/state. firestore.rules afgrænser adgang til kontoens egne data og kræver bekræftet e-mail. D1 afgør ejerskab og delingsrettigheder til trackere.
- GCP_FIREBASE_AUTH_SERVICE_ACCOUNT skal høre til samme projekt. Kundeadministration kræver Firebase Authentication Admin. Automatisk sletning af profildata kræver desuden Firestore-adgang, fx Cloud Datastore User. Kontrollér den faktisk tildelte konto i IAM.
- Browser key oprettet af Firebase er særskilt fra Geolocation-nøglen. Den skal ikke IP-begrænses til Traccar-pc’en, da kundernes telefoner også bruger den. Bevar passende Firebase-API-begrænsninger. API-nøglen erstatter ikke rettighedskontrol.

## Google Geolocation API

| Indstilling | Registreret værdi |
| --- | --- |
| API | Geolocation API; geolocation.googleapis.com |
| Nøgle | Separat Pejlo Geolocation-nøgle; værdien udfyldes privat. |
| Application restrictions | IP addresses: 188.228.64.102, senest registreret 19. november 2026. |
| API restrictions | Kun Geolocation API. |
| Requests per day | 100 i testopsætningen; gælder projektet, ikke hver bruger. |
| Øvrige viste kvoter | 6.000 pr. minut; pr. minut pr. bruger var Unlimited. |
| Månedsbudget | 50 kr.; mailalarmer ved 25, 45 og 50 kr. |
| Budgetomfang | Opsat med All services. Kontrollér omfanget i Billing → Budgets & caps. |

Budgettet er en alarm og stopper ikke automatisk Maps-forbruget. Døgnkvoten begrænser antal opslag og kan give afviste opslag, når den er brugt. Ændringer af appens polling ændrer ikke i sig selv Traccars globale Google-opslag. [1, 2, 3]


# Windows netværk og Traccar

| Punkt | Registreret værdi eller felt |
| --- | --- |
| Traccar offentlig web og API | https://pejlo.duckdns.org |
| Traccar lokal web | http://localhost:8082 |
| Tracker | Q8 4G / Q8_H; JT808 |
| Unikt tracker-id | 080608317309 – behold første nul. |
| IMEI | 868017077662687 – er ikke det registrerede JT808-id. |
| Traccar installation | C:\Program Files\Traccar |
| Konfiguration | C:\Program Files\Traccar\conf\traccar.xml |
| Database og logs | data\ og logs\ under installationsmappen. H2: jdbc:h2:./data/database. |
| Windows-tjenester | traccar og PejloCaddy |
| DNS-opdatering | Planlagt opgave PejloDuckDNS; hver 5. minut, SYSTEM. |
| Caddyfile og DuckDNS-script | Faktiske filstier: [UDFYLD PRIVAT] |
| Pc og lokal IP | Pc-navn: [UDFYLD] • fast/reserveret LAN-IP: [UDFYLD] |
| Traccar og Caddy versioner | [UDFYLD ved næste kontrol] |

| TCP-port | Brug | Viderestilling |
| --- | --- | --- |
| 443 | Caddy HTTPS → 127.0.0.1:8082 | Til Traccar-pc’ens LAN-IP. |
| 80 | Caddy HTTP og certifikatopsætning | Til samme pc i den anvendte opsætning. |
| 5015 | Trackerens JT808-data | Til samme pc. |
| 8082 | Traccars webport internt | Skal ikke åbnes direkte mod internettet. |

Caddys proxy skal pege på 127.0.0.1:8082. Den eksisterende HTTPS-opsætning og Windows Firewall skal følge med ved flytning. Pc’en skal være tændt og vågen. Browseren kan lukkes.

Tidsafkodningen blev rettet for enheden. Registrér den fungerende decoder.timezone: [UDFYLD fra enheden]. Bevar den ved flytning, og kontrollér fixTime mod en ny fysisk måling. Pejlos døgn og tidsvisning bruger Europe/Copenhagen.


# Mobilplacering og trackerindstillinger

Følgende seks poster blev tilføjet inden i <properties> i traccar.xml. Bevar databaseopsætningen og andre eksisterende poster. Indsæt kun den særskilte Geolocation-nøgle i geolocation.key.

```
<entry key='geolocation.enable'>true</entry>
<entry key='geolocation.type'>google</entry>
<entry key='geolocation.key'>UDFYLD_PRIVAT</entry>
<entry key='geolocation.processInvalidPositions'>true</entry>
<entry key='geolocation.reuse'>true</entry>
<entry key='geolocation.requireWifi'>false</entry>
```

processInvalidPositions tillader opslag ved ugyldige GPS-positioner. requireWifi=false tillader opslag uden Wi-Fi-data. reuse=true tillader Traccars genbrugsmekanisme; det er ikke en garanti for, at alle gentagne opslag er gratis eller undgås. Konfigurationen styrer hele Traccar-serveren. [4]

## Genstart og kontrollér

```
Restart-Service traccar
Get-Service traccar,PejloCaddy
Get-Content 'C:\Program Files\Traccar\logs\tracker-server.log' -Tail 50
```

Kør i PowerShell som administrator efter backup og en gemt XML-fil. Status Running bekræfter, at tjenesten er startet; den bekræfter ikke, at Google-opslaget virker.

## SMS til den nuværende Q8

```
SL DPpejlo.duckdns.org#5015#
SL CX
```

Første kommando sætter den kendte server på den afprøvede tracker. Anden forespørger dens indstilling. Gem svarene. Kommandoerne må ikke antages at passe til andre modeller eller firmware.

Traccars Registrering står fra i den viste serveropsætning. Brug en stærk, unik adgangskode til Traccar-admin. HTTPS beskytter web/API; det er ikke dokumentation for krypteret JT808 på 5015. TLS-forsøg fra fremmede IP-adresser i loggen beviser hverken indbrud eller fuld sikkerhed.


# Admin og opdateringsintervaller

## Skift aktiv Traccar-server

1. Åbn Pejlo /admin/ → Traccar-forbindelse. Indtast serverens offentlige HTTPS-adresse uden sti og token fra den konto på netop den server, som kan se trackerne.
2. Tryk Test forbindelse. Kontrollér listen: alle allerede tilknyttede trackere skal findes med samme unikke tracker-id. Et internt deviceId må gerne ændres.
3. Tryk Aktivér testet server. Kontrollér den viste aktive adresse. Skiftet gælder alle Pejlo-brugere og baggrundsalarmer ved deres næste kald.

## Tillad mobilplacering for en bruger

Systemadmin → Kunder og abonnementer → vælg bruger → Mobilplacering → markér feltet → Gem mobilplacering. Standard er fra, også for admin. Valget håndhæves for den aktuelle læser, også på delte profiler. Det styrer adgang i Pejlo og stopper ikke Traccars Google-opslag.

GPS har førsteprioritet. Estimatet vises kun, når GPS mangler eller er over fem minutter gammelt, og estimatet er nyere. Det skal være højst fem minutter gammelt og have en kendt positiv usikkerhedsradius. Mobilpunkter indgår ikke i GPS-ruter eller områdealarmer.

| Funktion | Interval eller grænse |
| --- | --- |
| Almindelig appopdatering | 15 sekunder efter seneste svar. |
| Aktiv Find-periode | 10 sekunder efter seneste svar. |
| Hele dagens rute | Cirka hvert minut, mens appen spørger. |
| Trackerens GPS-rapporter | Cirka 30 sekunder i de viste logs; styres af trackeren. |
| Baggrundsalarmer | Cron hvert minut; højst 8 relevante trackere i rotation pr. kørsel. |
| Geofence | To forskellige friske GPS-punkter; standardmargen 5 m, valg 0–30 m. |
| Pauser og arkiv | Personlige pauser 1/4/12 timer; alarmarkiv 90 dage. |

Kortet følger nye positioner med bevaret zoom. Manuel trækning og Vis hele ruten pauser følgningen. Centrér-knappen eller Følg trackeren på kortet genstarter den. Find-afstand og kompas bruger fortsat GPS, ikke centrum af et mobilestimat.


# Valgfrie tjenester og betaling

Disse integrationer findes i koden. At de står her betyder ikke, at nøglerne er oprettet, eller at livebetaling og forbrugsmåling er testet.

| Cloudflare-navn | Type | Formål |
| --- | --- | --- |
| STRIPE_SECRET_KEY | Secret | Stripe API; test eller live. |
| STRIPE_WEBHOOK_SECRET | Secret | Kontrol af webhook-signatur. |
| STRIPE_PORTAL_CONFIGURATION | Variable | bpc_… for kundeportalen. |
| STRIPE_PRICE_MONTHLY_FIRST | Variable | price_…; 49 kr. pr. måned. |
| STRIPE_PRICE_MONTHLY_EXTRA | Variable | price_…; 29 kr. pr. måned. |
| STRIPE_PRICE_ANNUAL_FIRST | Variable | price_…; 449 kr. pr. år. |
| STRIPE_PRICE_ANNUAL_EXTRA | Variable | price_…; 269 kr. pr. år. |
| STRIPE_PRICE_BIENNIAL_FIRST | Variable | price_…; 799 kr. pr. 24 måneder. |
| STRIPE_PRICE_BIENNIAL_EXTRA | Variable | price_…; 479 kr. pr. 24 måneder. |
| CF_ACCOUNT_ID | Variable | Cloudflare-konto for forbrugsmåling. |
| CF_ANALYTICS_TOKEN | Secret | Læseadgang til Cloudflare Analytics. |
| GCP_MONITORING_SERVICE_ACCOUNT | Secret | Hele JSON-nøglen til Google Monitoring. |
| PEJLO_TRACKER_ACTIONS | Secret | JSON med afprøvede Find-/lydkommandoer pr. tracker-id. |

Stripe-webhook: https://pejlo.driftportal-platform.workers.dev/api/stripe/webhook. Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid og invoice.payment_failed. Alle nøgler og price-id’er skal høre til samme Stripe-miljø.

24-måneders Checkout er kun åbent i testmiljøet i denne kode. Ændring af loginadgang stopper ikke et Stripe-abonnement. Find- og lydkommandoer må først indsættes efter fysisk afprøvning på den konkrete firmware; uden opsætning tilbydes de ikke som aktive kommandoer.


# Når den offentlige IP ændres

Brug denne vejledning, når internetudbyderen ændrer den offentlige IP, mens pc og domæne er de samme. Sidst registrerede IP var 188.228.64.102; den er ikke garanteret fast.

| Sted | Hvad ændres ved ny offentlig IP |
| --- | --- |
| DuckDNS | DNS-posten for pejlo skal følge den nye offentlige IP. |
| Google Geolocation-nøgle | IP addresses skal tillade Traccar-pc’ens nye udgående offentlige IP. |
| Router | Kontrollér WAN-adgang og portregler; LAN-målet ændres kun, hvis pc’ens lokale IP ændres. |
| Trackerens servernavn | Ingen ændring, når pejlo.duckdns.org og port 5015 bevares. |
| Pejlos servervalg | Ingen ændring, når HTTPS-navn og token stadig virker. |
| Cloudflare og Firebase | Ingen ændring af login-, push- eller mailnøgler alene på grund af ny IP. |

1. Find den nye offentlige IP i routerens WAN-/internetstatus. Kontrollér, at forbindelsen stadig giver indgående adgang; et skift til CGNAT eller dobbelt NAT kan kræve hjælp fra udbyderen.
2. Åbn Windows Opgavestyring → PejloDuckDNS → Kør. Kontrollér seneste resultat og DNS: Resolve-DnsName pejlo.duckdns.org. Den registrerede opgave kører også automatisk hvert femte minut.
3. Google Cloud → pejlo-a1fed → APIs & Services → Credentials → den separate Geolocation-nøgle → Application restrictions → IP addresses. Erstat gammel adresse med den nye offentlige udgående IP, og gem. Trackerens mobilnet-IP er ikke den rigtige adresse her.
4. Kontrollér routerens TCP 80, 443 og 5015 mod den rigtige LAN-IP samt Windows Firewall. Test derefter HTTPS fra telefonen på mobildata, ikke kun fra hjemmets Wi-Fi.
5. Kontrollér en ny fysisk GPS-position i Traccar og Pejlo. Test Google-opslag uden GPS særskilt; nøglens ændringer kan bruge nogle minutter på at slå igennem.

Ændres kun pc’ens lokale IP på samme internetforbindelse, er routerens mål det vigtigste. Google-listen skal kun ændres, hvis den udgående offentlige IP også ændres. DuckDNS’ automatiske opdatering retter ikke Googles tilladte IP-liste. [5]


# Skift tilbage til demo serveren

Eksemplet bruger den tidligere demo3-server. Kontrollér først, at din konto og de ønskede trackere stadig findes på den server. Et Pejlo-login er ikke et Traccar-login.

1. Notér den nuværende aktive server, og gem tokenet privat. Tag backup af den lokale Traccar-installation, hvis du vil bevare dens historik. Gem også den fungerende tidszone for trackeren.
2. Log på https://demo3.traccar.org med din demo-konto. Kontrollér, at 080608317309 findes og er tilgængelig for kontoen. Opret tilsvarende enheder for alle Pejlo-trackere, der skal med. En enhed, der ejes af en anden demo-konto, skal frigøres eller deles korrekt først.
3. Opret eller find et API-token på demo-serveren fra den rigtige konto. Tokenet til din egen Windows-server kan ikke antages at virke på demo-serveren.
4. Send SMS til den afprøvede Q8: SL DPdemo3.traccar.org#5015# . Bekræft svaret med SL CX. Flyt hver tracker til den nye server. Kontrollér ny kontakt og en frisk, korrekt tidsstemplet GPS-position i demo-serverens webvisning.
5. I Pejlo /admin/ → Traccar-forbindelse: adresse https://demo3.traccar.org, demo-token, Test forbindelse og Aktivér testet server. Vent på næste appopdatering og baggrundskørsel.
6. Kontrollér profil, placering, tid og batteri i Pejlo. Afprøv en ny områdepassage og push. Eksisterende Pejlo-ejere og profiler bevares, fordi de bruger samme unikke tracker-id. GPS-filteret starter separat for den nye aktivering.

## Det der ikke flyttes automatisk

- Traccars rå GPS-historik ligger på hver server. Den overføres ikke ved at ændre URL eller sende SMS. Pejlos D1-alarmarkiv og Firestore-profiler bevares, men dagens rute hentes fra den nye server.
- Du kan normalt ikke styre demo-serverens globale Google-nøgle, database eller geolocation-indstillinger. Overfør ikke din private Google-nøgle til et offentligt demo-setup.
- Demo-serveren er en ekstern tjeneste. Konto, adgang og retention skal kontrolleres. Egen Caddy, DuckDNS og routerportene bruges ikke af trackeren, mens den sender direkte til demo3.

Tilbage til egen server: bekræft den lokale server, send SL DPpejlo.duckdns.org#5015# og få et nyt GPS-punkt dér. Test og aktivér derefter https://pejlo.duckdns.org med det lokale token i Pejlo. At ændre TRACCAR_URL i Cloudflare alene tilsidesætter ikke et aktivt adminvalg.


# Flyt Traccar til en anden pc

Flyt i første omgang til samme Traccar-version som den gamle pc. Skift ikke databaseformat og serverversion samtidig med flytningen. De faktisk installerede versionsnumre skal noteres før arbejdet.

1. På gammel pc: tag backup af traccar.xml, hele data-mappen, media hvis brugt og øvrige tilrettede filer. H2 skal kopieres, mens traccar-tjenesten er stoppet. Start den igen, hvis der går tid før selve flytningen.
2. Gem Caddyfile, HTTPS-/certifikatdata og tjenesteopsætning samt DuckDNS-script og opgave. Notér pc-navn, LAN-IP, routerportregler, tjenesternes startkonto og Google-nøglens tilladte IP. Behold en kopi af den gamle installation.
3. Installér samme Traccar-version på ny pc. Stop dens traccar-tjeneste. Gendan kopier af konfiguration, data og eventuelt media. Ret kun nødvendige lokale stier og filrettigheder. Del aldrig den samme H2-fil mellem to kørende installationer.
4. Genskab PejloCaddy med proxy til 127.0.0.1:8082 og samme domæne. Flyt Caddys nødvendige certifikatdata med korrekte rettigheder eller lad Caddy udstede på ny, når domæne og porte peger rigtigt. Genskab PejloDuckDNS og Windows Firewall.
5. Ved endeligt skift: stop den gamle Traccar, og tag en sidste konsistent backup. Gendan den på ny pc. Ret routerens TCP 80, 443 og 5015 til den nye pc’s reserverede LAN-IP. Start tjenesterne på ny pc. Undgå to DuckDNS-opgaver, der kæmper om samme navn fra forskellige internetforbindelser.
6. Er den offentlige IP ændret, følg IP-vejledningen og ret Google-nøglens IP-liste. Er domænet ændret, ret Caddy og DuckDNS, send trackerens nye serverkommando, og test/aktivér den nye HTTPS-adresse med dens token i Pejlo.
7. Kontrollér fra telefonens mobildata: HTTPS-login, ny GPS, korrekt tid, historik, Pejlo-visning og en ny pushalarm. Genstart pc’en og kontrollér automatisk opstart, DNS-opgave og drift uden åben browser.

Samme domæne, port og gendannet database: trackeren behøver normalt ingen ny SMS. Pejlo behøver normalt heller intet nyt servervalg, hvis det eksisterende token virker efter gendannelse. Ved tom ny database skal samme tracker-id’er oprettes, et token fra den nye konto bruges, og serveren testes og aktiveres igen.

Tilbagerulning: stop den nye installation. Ret router/DNS tilbage til gammel pc, start den gamle tjeneste og kontrollér nyt GPS-punkt. Hvis Pejlos servervalg blev ændret, aktivér den gamle adresse og dens token igen. Gem data fra begge installationer; historik fra flytteperioden flettes ikke automatisk. [6]


# Privat register over nøgler

Dette er en tom skabelon. Skriv værdier eller henvisninger til din adgangskodeadministrator i en privat kopi. Den udfyldte kopi skal ikke ligge i GitHub. Lange JSON-nøgler gemmes som beskyttede filer; notér kun filens placering her.

| Nøgle eller værdi | Privat værdi eller sikker reference |
| --- | --- |
| Traccar-token til egen server | [UDFYLD PRIVAT]<br>_______________________________ |
| Traccar-token til demo3 | [UDFYLD PRIVAT]<br>_______________________________ |
| TRACCAR_CONFIG_SECRET | [UDFYLD PRIVAT]<br>_______________________________ |
| TRACCAR_ADMIN_UID | [UDFYLD PRIVAT]<br>_______________________________ |
| Google Geolocation API key | [UDFYLD PRIVAT]<br>_______________________________ |
| Firebase Browser API key | [UDFYLD PRIVAT]<br>_______________________________ |
| MAPTILER_API_KEY | [UDFYLD PRIVAT]<br>_______________________________ |
| RESEND_API_KEY | [UDFYLD PRIVAT]<br>_______________________________ |
| VAPID_PRIVATE_KEY | [UDFYLD PRIVAT]<br>_______________________________ |
| VAPID_PUBLIC_KEY | [UDFYLD PRIVAT]<br>_______________________________ |
| DuckDNS-token | [UDFYLD PRIVAT]<br>_______________________________ |
| Firebase service account JSON | Sikker filsti/reference: [UDFYLD PRIVAT]<br>_______________________________ |

Ved skift af TRACCAR_CONFIG_SECRET skal det gemte servervalg kunne dekrypteres eller oprettes på ny med et kendt Traccar-token. Ved normalt IP- eller pc-skift skal denne nøgle bevares. Ved skift af privat pushnøgle skal enhederne normalt afmelde og aktivere beskeder igen.


# Private konti og lokale felter

| Konto eller oplysning | Udfyld i din private kopi |
| --- | --- |
| GitHub konto og gendannelse | Login: ____________________<br>Kode eller reference: ____________________ |
| Cloudflare konto og gendannelse | Login: ____________________<br>Kode eller reference: ____________________ |
| Google Cloud og Firebase konto | Login: ____________________<br>Kode eller reference: ____________________ |
| Traccar egen server | Login: ____________________<br>Kode eller reference: ____________________ |
| Traccar demo3 | Login: ____________________<br>Kode eller reference: ____________________ |
| Windows og router | Pc-/routerlogin og kodehenvisning:<br>________________________________ |
| MapTiler og Resend | Login og kodehenvisning:<br>________________________________ |
| DuckDNS konto | Login og kodehenvisning:<br>________________________________ |
| Stripe og valgfrie API-nøgler | Miljø samt reference til STRIPE_…, CF_ANALYTICS_TOKEN og GCP_MONITORING_SERVICE_ACCOUNT:<br>________________________________ |
| Driftsfelter | Ny offentlig IP: ____________________<br>Ny LAN-IP: ____________________<br>Ny pc: ____________________ |
| Lokale stier | Caddyfile: ____________________<br>DuckDNS-script: ____________________<br>Backup: ____________________ |

Dato for seneste ændring: ____________________
Udført af: ____________________
Ny GPS, tid og push kontrolleret: ____________________


# Backup fejlsøgning og referencer

## Gem disse dele samlet

- Traccar: konsistent H2-data, traccar.xml og eventuelt media. Stop tjenesten før filkopi af databasen. Gem også installeret versionsnummer.
- Caddy, DuckDNS, routerregler, Windows-opgaver og tjenestekonti. Private nøgler og certifikatdata opbevares beskyttet.
- Pejlo: GitHub-kildekode samt D1 og Firestore efter deres backup-/eksportmetoder. GitHub indeholder ikke i sig selv de aktive brugere, historik eller Cloudflare-secrets.
- Gem TRACCAR_CONFIG_SECRET sammen med en beskyttet gendannelsesplan for D1. Opbevar backup på en anden enhed end Traccar-pc’en.

| Symptom | Kontrollér først |
| --- | --- |
| App virker, men ingen ny GPS | Trackerdata på 5015, fixTime, gyldighed og satellitter. Online er ikke det samme som GPS. |
| Havplacering ved 0,0 | Ingen gyldig position. 0,0 afvises i Pejlo; find den reelle GPS-fejl. |
| GPS virker, Google fejler | Tilladt udgående IP, nøgle/API-begrænsning, billing, døgnkvote og Traccar-log. |
| Virker lokalt, ikke på 5G | DuckDNS, router/WAN/CGNAT, firewall og Caddy på 443. |
| Admin viser gammel server | Brug Test forbindelse og Aktivér testet server. Cloudflare-fallback er ikke det aktive adminvalg. |
| Geocoder HTTP 404 | Adresseopslag er en anden funktion end GPS og Google Geolocation. |
| Kort mangler efter build | MAPTILER_API_KEY under Builds og nøglens tilladte appdomæner. |

## Referencer og vedligeholdelse

Interne kilder: Pejlo 0.8.51, apps/api, apps/web, packages/shared, wrangler.jsonc og opsætningen registreret 19. november 2026. Kodeversionen bestod 176 automatiske tests. Kvittering for upload og fysisk Google-test registreres i driftsloggen.

[1] Google Geolocation usage and billing: https://developers.google.com/maps/documentation/geolocation/usage-and-billing
[2] Google budgetter: https://docs.cloud.google.com/billing/docs/how-to/budgets
[3] Firebase API keys: https://firebase.google.com/docs/projects/api-keys
[4] Traccar configuration: https://www.traccar.org/configuration-file/
[5] DuckDNS API: https://www.duckdns.org/spec.jsp
[6] Traccar backup: https://www.traccar.org/backup/
