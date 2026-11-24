# Pejlo 0.8.59 – automatisk positionsforespørgsel

Bygger på 0.8.58. Pakken indeholder kun nye og ændrede filer og er ikke automatisk udgivet.

## Adfærd

Serverens eksisterende minut-cron beder om en ny position, hvis den seneste godkendte GPS eller kontakt er mindst 15 minutter gammel, og trackeren er online. Kontrollen bruger GPS-filterets godkendte position; en ny ugyldig position, mobilestimat eller heartbeat gør ikke en gammel GPS-position frisk. Førstegangsopsætning uden kendt GPS/kontakt venter en hel grænseperiode. En fejl i upstream-opslag udløser ikke en kunstig positionsforespørgsel.

Standard er aktiv 15-minutterskontrol for serverens godkendte, ejede trackere med gemt profil. Indstillinger → Tracker → Batteri og opdateringer giver ejeren fra/til, valg mellem 10 og 15 minutter samt læsning af status. Dette er en automatisk funktion efter udgivelse, ikke kun en visning i den åbne app.

Højst ét automatisk forsøg hvert 15. minut og højst tre i samme periode uden frisk GPS og kontakt. Derefter pause. Frisk godkendt GPS og kontakt eller en eksplicit ny gemning af indstillingen nulstiller forsøgene. Offline enheder får ingen kommando; der afventes forbindelse. En aktiv TCP-forbindelse eller et HTTP-svar garanterer ikke modtagelse eller GPS-fix. Ingen SMS, ukendt dvalekommando eller ekstra intervalændring er tilføjet.

Den eksisterende manuelle enkeltpositionskommando er samlet i position-request.js og bruges uændret af begge forløb. Kun positionSingle tilbydes; der er ingen custom-fallback. Kommandoen sendes med noQueue=true. Et eventuelt 202-svar fra Traccar vises som kø/uafklaret, og også fejl/timeout bevarer den automatiske 15-minutters pause. Den manuelle og automatiske kommando deler en atomisk minutbegrænsning. Automatiske kørsler deler desuden en to-minutters lås, og forsøget reserveres før afsendelse, så et afbrudt svar ikke straks giver en ny kommando.

## Installation

1. Upload de udpakkede filer til repositoryets rod med samme mapper oven på 0.8.58. Udgiv både API og web med det normale build.
2. Bevar Cloudflare Worker, D1-binding DB, secrets, MAPTILER_API_KEY i buildmiljøet og cron hvert minut. Den nye D1-tabel pejlo_position_refresh oprettes automatisk; ingen manuel migration kræves.
3. Som standard genbruges PEJLO_BATTERY_DEVICES som liste over godkendte tracker-id'er. Hvis den stadig indeholder 080608317309, starter kontrollen for Loui efter udgivelse. En valgfri PEJLO_POSITION_REFRESH_DEVICES kan i stedet angive en særskilt kommasepareret liste; en eksplicit tom værdi slår funktionen fra på serveren. Ingen ny variabel er nødvendig for den eksisterende Loui-opsætning.
4. Kontroller version 0.8.59 og indstillingen under Tracker. Brug Hent status for positionskontrol for at se resultatet. Grænsen kan ændres til 10 minutter; gentagne automatiske forsøg har fortsat mindst 15 minutters afstand.

Tilstand er adskilt efter serverkilde, tracker og ejer. Der kontrolleres aktuelt ejerskab og en gemt profil, også før afsendelse. Kontosletning fjerner tilstanden og profilen, så en slettet konto ikke genopretter en aktiv kontrol. Op til otte trackere kontrolleres pr. cron, ældst kontrollerede først; større installationer kan derfor have længere forsinkelse. HTTP-fejl tælles i den eksisterende upstream-overvågning.

## Afprøvning og begrænsning

Se efter en udgående positionsforespørgsel i Traccar-loggen, når en online tracker har en gammel godkendt position. Kontroller at der ikke kommer gentagne forespørgsler hvert minut. Ved offline skal status vise afventer forbindelse. Kontroller derefter frisk GPS og nulstilling af forsøgstælleren. Slå funktionen fra under Tracker for at afbryde automatisk afsendelse.

251 automatiske tests består, herunder 11 nye for gammel GPS/kontakt, friske data, offline og genforbindelse, upstream-fejl, pause, tre-forsøgsgrænse, samtidighed, timeout/kø, godkendelse og ejerskab, kontosletning, indstillingslås og profilskift i UI. Eksisterende manuelle positionskommandoer og API-rettigheder er fortsat testet. Build og syntakskontrol er gennemført.

Den automatiske funktion er endnu ikke fysisk afprøvet på Loui-trackeren eller i rigtig browser/PWA i udviklingsmiljøet. En positionsforespørgsel kan ikke skabe satellitsignal indendørs eller garantere opvågning fra firmwaredvale. Batterigevinsten fra de tidligere intervalændringer er fortsat en separat test.
