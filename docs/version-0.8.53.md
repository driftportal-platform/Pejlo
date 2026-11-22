# Pejlo 0.8.53

Wi-Fi-signalstyrke og en vejledende vurdering af, om trackeren er inde eller ude. Bygget videre på den uploadede Pejlo 0.8.52.

## Installation

Pak ZIP-filen ud. Upload indholdet til roden af dit eksisterende GitHub-repository, så apps, packages, scripts, tests, docs, dist og package.json ligger på samme niveau som før. Lad det normale Cloudflare-build køre, og kontrollér version 0.8.53 på loginvisningen.

Den samlede kode og de byggede webfiler er med. Ingen nye hemmeligheder, databaseændringer eller SMS-kommandoer kræves. Den eksisterende MAPTILER_API_KEY skal fortsat være tilgængelig i Cloudflares buildmiljø som før. Koden er ikke automatisk lagt på GitHub eller udgivet.

## Vælg hjemmets Wi-Fi

1. Åbn Indstillinger → Profil → Hjemmets Wi-Fi.
2. Indtast de bekræftede BSSID-adresser, adskilt med komma. Adresserne identificerer de enkelte Wi-Fi-radioer; netværksnavnet alene er ikke tilstrækkeligt. Indtast ikke Wi-Fi-adgangskoden.
3. For Stefans Google_mesh_stueplan er disse to adresser bekræftet ved sammenligning af Windows-scanning og trackerens pakker:

   `28:BD:89:05:5C:47, 28:BD:89:05:5C:10`

4. Tryk Gem profil. Vurderingen bruger kun de valgte adresser. Ingen adresser bliver automatisk tilføjet til andre profiler.

Trackeren logger ikke på hjemmenetværket. Dens eksisterende Wi-Fi-scanninger leverer adresser og RSSI i dBm til Traccar. Serveren sender validerede felter videre til autoriserede brugere af den tracker.

## Indlæring

Placér den tændte tracker på flere kendte steder indenfor. Vent på nye målinger, og tryk Gem måling inde. Gentag mindst tre gange med mindst 20 sekunder mellem de gemte målingers tidspunkter.

Gør derefter det samme på mindst tre steder udenfor, herunder ved huset og ude i haven, og vælg Gem måling ude. Flyt trackeren mellem stederne. Gem også målinger ved døre og vinduer, hvor signalerne kan ligne hinanden. Kontrollér senere vurderingen på andre steder end dem, der blev brugt under indlæringen.

Appen begynder først at sammenligne inde og ude efter mindst tre målinger af hver. Det er et minimum for funktionen, ikke dokumentation for en bestemt træfsikkerhed. Kan målingerne ikke skelnes tydeligt, bliver resultatet Usikkert. Nulstil og indlær igen, hvis mesh-punkter flyttes eller udskiftes. Ændring af Wi-Fi-adresser eller tracker i profilen rydder tidligere indlæring.

## Visning

På kortets oplysninger vises Sandsynligvis indenfor, Sandsynligvis udenfor eller Usikkert sammen med forklaring og målingens alder. Under trackeroplysninger ses en Wi-Fi-signalbjælke, den stærkeste målte hjemmeradio og RSSI for de registrerede valgte punkter.

Gamle eller udaterede målinger og offline/ukendte trackere giver Usikkert. En måling er højst to minutter gammel for at blive brugt aktuelt. Manglende Wi-Fi bliver aldrig i sig selv fortolket som udenfor. Tidspunkt fra trackerens deviceTime bruges, når det foreligger, så forsinkede pakker ikke bliver nye målinger blot ved at ankomme. Uden deviceTime kan kun modtagelsestiden bruges.

Der vises ingen procentvis sandsynlighed. Vurderingen er en sammenligning med de gemte signalmønstre. Den kan tage fejl, blandt andet ved vinduer, på grund af vægge, kattens kropsstilling og ændret placering af Wi-Fi-punkter. Appen ændrer ikke GPS-position, GPS-geofencealarmer eller batteriforbrug.

## Tekniske detaljer

- Traccar-positionens network.wifiAccessPoints overføres som telemetry.wifiAccessPoints med mac og rssi.
- Højst 16 punkter og 40 indlæringsmålinger gemmes pr. profil. Kun gyldige unicast MAC-adresser og heltal fra -100 til -1 dBm accepteres; dubletter samles til stærkeste signal.
- homeWifi indeholder den valgte profils adresser og målinger og følger profilens eksisterende lagring og delingsrettigheder. Læsere kan ikke gemme eller nulstille indlæring.
- Den gennemsnitlige absolutte RSSI-forskel beregnes mod sammenlignelige gemte målinger. Mindste afstand til hver gruppe sammenlignes. Bedste match må højst afvige 8 dB, og forskellen mellem grupper skal være mindst 8 dB. Det er forsigtige startværdier, der kræver afprøvning i hjemmet.
- Nearest sample-metoden er vejledende. Den er ikke en statistisk sandsynlighedsmodel.

## Kontrol før brug

Kør npm test. Alle 187 tests består i den leverede kode. Automatiske tests dækker målinger, profilopbevaring, adgangskontrol, gamle og forsinkede pakker, manglende Wi-Fi og tvetydige signalmønstre samt den eksisterende funktionalitet. Den automatiske browserkontrol kunne ikke starte i arbejdsmiljøet; mobil- og desktopvisningen og de virkelige inde/ude-resultater skal derfor kontrolleres efter upload.

Bekræft efter udgivelse, at trackeroplysninger viser Wi-Fi og nye tidspunkter. Hvis de rå pakker har Wi-Fi, men appen ikke får dem, skal Traccars API-svar undersøges, før der ændres flere indstillinger.
