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
