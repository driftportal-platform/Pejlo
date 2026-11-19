# Pejlo 0.8.49 – servervalg i systemadmin

Upload ZIP-filens indhold til samme mapper i GitHub. Den indeholder kun ændringer fra 0.8.48. Cloudflare bygger som hidtil med `npm run build` og deployer med Wrangler. Ingen eksisterende betalings-, kunde- eller delingsfunktioner fjernes.

## Engangsopsætning

1. I Cloudflare Worker → Settings → Variables and Secrets: tilføj en **Secret** med navnet `TRACCAR_CONFIG_SECRET` og mindst 32 tilfældige tegn fra en adgangskodegenerator. Gem en sikker kopi. Denne nøgle krypterer Traccar-tokenet i databasen; ændres eller slettes den, kan den gemte opsætning ikke åbnes.
2. Sørg for offentlig HTTPS-adgang til Traccars web/API med et gyldigt certifikat. `http://localhost:8082` og trackerport 5015 kan ikke anvendes som API-adresse fra Pejlo. DuckDNS alene opsætter ikke HTTPS. Brug ikke en HTTPS-adresse før den faktisk virker.
3. Opret et API-token på den ønskede Traccar-server fra den konto, som har adgang til Pejlos trackere. Behold tokenet privat.
4. Åbn Pejlos systemadmin `/admin/`. Under **Traccar-forbindelse** indtastes serverens HTTPS-adresse uden sti og tokenet fra netop denne server.
5. Tryk **Test forbindelse**. Panelet viser tilgængelige trackere og deres unikke tracker-ID. Alle allerede tilknyttede trackere skal findes med samme unikke ID på den nye Traccar-server. Traccars interne deviceId må gerne være anderledes. Manglende trackere skal oprettes på den nye Traccar-server, før den kan aktiveres.
6. Tryk **Aktivér testet server**. Aktiveringen tester forbindelsen igen. Ingen indstillinger ændres ved en mislykket test. Skiftet gælder hele Pejlo og baggrundsalarmerne ved deres næste kørsel; en allerede igangsat forespørgsel kan afslutte med den tidligere opsætning.

Tokenet gemmes AES-GCM-krypteret i D1, bliver aldrig returneret i API-svar og gemmes ikke i browserens localStorage. Tabellen oprettes automatisk. Der kræves ingen manuel SQL-migration. Indtil første aktivering bruges de eksisterende Cloudflare-værdier `TRACCAR_URL` og `TRACCAR_TOKEN` uændret. Senere ændringer i disse værdier overskriver ikke servervalget i admin. For at skifte tilbage testes og aktiveres den tidligere adresse med dens token i samme panel.

Hver aktivering får sit eget GPS-filter. Positioner og batterimålinger fra en tidligere server bruges ikke som nye målinger. Profiler, ejere, parringer, områder, abonnementer og alarmarkiv bevares. Der kan derfor stå “GPS-position mangler”, indtil den nye server har leveret gyldige målinger. Live-visningen genbruger ikke rute fra en anden server efter skift.

## GPS uden position

Koordinaterne 0,0 afvises også, hvis en rapport fejlagtigt siger `valid=true`. En gammel 0,0-position ryddes fra GPS-filteret. Mangler gyldig position, vises **GPS-position mangler**. En tidligere reel, godkendt position på samme aktive server bevares med sit oprindelige tidspunkt. Kontakt, mobil-/satellitoplysninger og batteri kan fortsat vises, selv om GPS-position mangler.

Denne version aktiverer ikke Google Geolocation/LBS. Det kræver særskilt opsætning i Traccar og håndtering af grove netværkspositioner i Pejlo.

## Validering

Automatiske tests dækker eksisterende funktioner samt adminadgang, servervalgets kryptering, fejlslagne tests, revision ved aktivering, tracker-ID-kontrol, anvendelse i tracker-API og baggrundsmonitor, browserens krav om ny test efter ændring samt nulkoordinater. Browserlayout og forbindelse til din private Traccar-installation er ikke live-testet.
