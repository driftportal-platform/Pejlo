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
