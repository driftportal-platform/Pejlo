# Pejlo 0.8.58

Hurtig Wi-Fi-opsætning samler og gemmer tre indemålinger og tre udemålinger automatisk. Allerede valgte hjemmepunkter genbruges. Nye punkter foreslås og bekræftes én gang. Genvej fra Wi-Fi-kortet og tydeligere skelnen mellem gemte punkter og manglende scanning. Se [versionsnoterne](docs/version-0.8.58.md).

# Pejlo 0.8.57

Automatisk batterisparetilstand ud fra indlært Wi-Fi og tidsbegrænset Find i 5/15 minutter. Serveren håndterer tilbagevending, også med lukket app. Aktiveres kun af ejeren; upload ændrer ingen trackerindstilling. GPS-dvale er fortsat ikke aktiveret. Se [versionsnoter](docs/version-0.8.57.md) og [batteristyring og kommandoer](docs/batteri-og-kommandoer.md).

# Pejlo 0.8.56

Batteritilstande, batterihistorik og antal gemte positionsrapporter. Se [Batteristyring og kommandoer](docs/batteri-og-kommandoer.md) samt [versionsnoterne](docs/version-0.8.56.md). Godkend konkrete trackere med runtime-variablen PEJLO_BATTERY_DEVICES før intervalstyring.

Ældre versionsbeskrivelser følger nedenfor.

# Pejlo 0.8.53

Wi-Fi-signalstyrke og indlæring af inde/ude er tilføjet. Se [vejledning til 0.8.53](docs/version-0.8.53.md).

Brugeren kan se sin kontos adgang til mobilplacering under Indstillinger → Tracker. Kun administratoren kan ændre valget. Se [ændringer i 0.8.52](docs/version-0.8.52.md).

# Pejlo 0.8.51

Pejlo er en PWA til GPS-trackere med personligt login, profiler, kort, historik, familiedeling og områdebeskeder.

Senest opdateret 19. november 2026. Dokumentationen beskriver kodeversion 0.8.51. Kontrollér den faktisk udgivne version efter Cloudflare-build.

## Dokumentation

- [Start og upload](START_HER.md)
- [Brugervejledning](docs/brugervejledning.md)
- [Tjenester og teknisk drift](docs/teknisk-drift.md)
- [Ny IP og serverskift](docs/ip-og-serverskift.md)
- [Ændringer i 0.8.51](docs/version-0.8.51.md)
- [Tidligere versionsnoter](docs/historisk-readme.md)

## Nuværende opsætning

Appen kører i Cloudflare Worker pejlo med D1-binding DB. Firebase Authentication og Firestore bruger projekt pejlo-a1fed. Egen Traccar på Ubuntu er tilgængelig via HTTPS på pejlo.duckdns.org; trackeren sender JT808 til TCP 5015. MapTiler leverer kort, Resend sender invitationer, og VAPID bruges til Web Push.

Aktivt servervalg findes i Systemadmin → Traccar-forbindelse. Et aktiveret valg har forrang for Cloudflares TRACCAR_URL/TRACCAR_TOKEN. Den historiske demo3-adresse i wrangler.jsonc er derfor ikke bevis for den aktuelt anvendte server.

0.8.51 tilføjer mobilplacering med usikkerhedscirkel og adminvalg pr. bruger samt automatisk følgning på kortet. Normal polling er 15 sekunder efter svar, aktiv Find 10 sekunder og rutehentning cirka hvert minut. Mobilplacering holdes ude af GPS-ruter og områdealarmer. Per-bruger-valget stopper ikke Traccars Google-opslag.

## Bygning

```sh
npm ci
npm test
npm run build
```

Cloudflare udgiver med `npx wrangler deploy`. MAPTILER_API_KEY skal findes i buildmiljøet. Node mindst 20 kræves. De øvrige secrets ligger i Cloudflare runtime, ikke i GitHub. Seneste kodevalidering: 176 automatiske tests bestod.

## Kildekodens mapper

- apps/web: PWA, login, profiler og kort.
- apps/api: rettigheder, Traccar, baggrundsalarmer og administration.
- packages/shared: fælles geografiske beregninger, GPS-filter og visningsregler.
- tests: automatiske tests.
- docs: gældende vejledninger og historiske versionsnoter.

## Private oplysninger

Skabelonerne indeholder tomme felter. Upload aldrig en udfyldt kopi med tokens, adgangskoder, private VAPID-nøgler, Google service account JSON eller private Google Geolocation-nøgler til GitHub.

