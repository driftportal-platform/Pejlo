# Pejlo 0.3 – start her

Denne pakke er til dit eget GitHub-repository og din egen Cloudflare-udgivelse.
Der kræves ikke ChatGPT-login til appen, når du selv udgiver den.

## 1. Upload til GitHub

1. Pak ZIP-filen ud.
2. Opret et nyt repository, fx `pejlo` (gerne privat).
3. Upload indholdet, så `package.json`, `wrangler.jsonc`, `apps`, `packages`, `scripts` og `dist` ligger i repositoryets rod.
4. Upload filerne og mapperne – ikke ZIP-filen. Undgå at lægge en ekstra `Find_dit dyr...`-mappe udenom hele projektet.

## 2. Cloudflare Workers (GitHub-forbindelse)

- Forbind dit repository under Workers & Pages.
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repositoryets rod (tomt felt eller `/`).
- Worker-navn: `pejlo`, som i `wrangler.jsonc`. Hvis du vælger et andet navn, skal konfigurationen bruge samme navn.
- `dist` er allerede angivet som mappen med webfiler i `wrangler.jsonc`.

Der er ingen Hello World-worker, som skal indsættes. Hele appen ligger i pakken.

Alternativt kan Cloudflare Pages bruges:
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repositoryets rod.

## 3. Prøv appen

- Åbn HTTPS-adressen fra Cloudflare.
- Vælg `Tilføj profil`, og opret fx kat, hund, hest, bil eller cykel.
- Skift mellem profiler i feltet øverst.
- Redigér navn og type under Indstillinger; ikonet følger med.
- Hver profil har eget fast udgangspunkt.
- Tryk Find [navn], og vælg Start søgedemo. Tryk Gå tættere på for at se meter og zoom ændre sig.
- Brug min placering starter mobilens placering efter browserens tilladelse. Kompas tillades særskilt.
- Når du forlader søgesiden eller skjuler appen, stoppes mobilens placering og kompas. Start igen, når du kommer tilbage.

## 4. Rigtige kortlag

Standardvisningen er et lokalt, skematisk eksempel. Det er ikke et geografisk kort.
Gadekort, satellit/luftfoto og terræn/stier er implementeret via MapTiler.
Tilføj en offentlig MapTiler-kortnøgle under Indstillinger, og vælg derefter kortlaget.
Nøglen skal have adgang til de valgte kort og være begrænset til dit Cloudflare-domæne.
Kontrollér MapTilers aktuelle abonnement og kvoter, før du tager kortene i brug.
Uden kortnøgle ændres der ikke til et kortlag, som appen ikke kan vise.

## Hvad denne udgave kan – og hvad der kommer senere

Denne udgave indeholder brugerflade, lokal profilopsætning, lokale indstillinger,
afstand/retning fra mobilens GPS til et eksempelpunkt, kompasstøtte og automatisk zoom.
Den kan have flere lokale trackerprofiler, men modtager endnu ingen fysiske trackerdata.
Alle målpositioner, ruter og batteriprocenter er eksempeldata. Den bruger ikke din rigtige Q8.
Forskellige profiler viser forskellige, men stadig opdigtede, eksempelruter.
Appen starter uden profiler. Brugeren vælger selv navn og type.

Kortlag med din egen nøgle og mobilkompas er ikke afprøvet på din iPhone endnu.
Retning er fugleflugtsretning, ikke gangnavigation. Ved lav GPS-præcision dæmpes pilen
og zoom begrænses. En gammel position kan være et sted, enheden har forladt.

Næste udviklingstrin er login, kundekonti, serverkontrollerede rettigheder og
Traccar-tilknytning pr. profil. Så kommer synkronisering mellem dine og dit dyrses telefoner.
Firebase er ikke oprettet og er ikke nødvendigt for at prøve denne udgave.
Der ligger ingen adgangskoder, tracker-ID'er, hemmelige nøgler eller rigtig hjemmeposition i pakken.

## Mapper

- `apps/web/src/features`: profiler, lokal lagring, kort, mobilplacering og eksempeldata.
- `apps/web/src/components`: fælles faste SVG-ikoner.
- `apps/web/src/assets/icons` og `images`: ikoner og faste billeder.
- `apps/web/src/styles`: fælles farver og layout.
- `packages/shared`: afstand, retning, koordinatkontrol og zoomregler.
- `apps/api`: næste trins serverarkitektur (ingen aktiv backend endnu).
- `docs`: arkitektur og kendte begrænsninger.
- `dist`: færdigbyggede webfiler. Genopbygges ved hver Cloudflare-build.

Lokalt: Node.js 20 eller nyere. Kør `npm test` for bygning og test.
Åbn appen via en lokal webserver, ikke ved at dobbeltklikke på HTML-filen.

## Kilder

- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://docs.maptiler.com/cloud/api/maps/
- https://docs.maptiler.com/guides/developer/credentials/api-key/
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition
- https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static

## Opdatering fra 0.2 til Pejlo 0.3
Upload hele pakkens indhold til det eksisterende GitHub-repository Pejlo, og erstat de gamle filer. Cloudflare bygger automatisk, når GitHub-forbindelsen er aktiv. Worker-navnet er `pejlo`.

Den urørte, automatisk oprettede Loui-eksempelprofil fjernes ved første start af 0.3. Egne profiler og ændrede gamle profiler bevares. Profiler, som brugeren selv kalder Loui, fjernes ikke. Kortnøgle bevares. Browseren gemmer herefter under en ny Pejlo-nøgle, så slettede profiler ikke kommer tilbage ved genindlæsning.

Hvis den gamle visning fortsætter efter en vellykket Cloudflare-udgivelse: genindlæs siden med Ctrl+F5 på Windows, eller luk og genåbn siden på mobilen.
