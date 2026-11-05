# Pejlo 0.5.0 – samlet GitHub-udgave

Denne udgave tilføjer Traccar-forbindelsen og tilknytning med **tracker-ID + parringskode**. Brugerne foretager tilknytningen i Pejlo. Kun administratoren skal sætte infrastrukturen op.

**Vigtigt: opret databasen nedenfor før upload/deploy.** `wrangler.jsonc` indeholder en markeret plads til dit rigtige database-ID. Udgaven er ikke allerede udgivet.

## 1. Opret trackerregisteret én gang

I Cloudflare: Storage & databases → D1 SQL database → Create Database. Navn: `pejlo-trackers`.

Kopiér databasens ID. Åbn `wrangler.jsonc` i denne pakke, og erstat `INDSAET_DATABASE_ID` med det kopierede ID. Behold bindingens navn `DB`.

Åbn D1-databasens Console, og kør indholdet af `apps/api/migrations/0001_trackers.sql`. Filen opretter tabellen og ejerindekset; den sletter ingen eksisterende data.

Alternativ med terminal, fra projektmappen:

```sh
npx wrangler d1 create pejlo-trackers
# Indsæt database-ID'et i wrangler.jsonc, behold binding DB.
npx wrangler d1 migrations apply pejlo-trackers --remote
```

## 2. Sæt to runtime-secrets på Workeren

Cloudflare → Workers & Pages → pejlo → Settings → Variables and Secrets, **uden for Builds**:

| Type | Navn | Værdi |
| --- | --- | --- |
| Secret | `TRACCAR_TOKEN` | Token fra den nye Traccar-konto |
| Secret | `TRACCAR_ADMIN_UID` | Dit Pejlo Firebase-bruger-ID (UID) |

Find UID i Firebase → Authentication → Users → vælg den bruger, du logger på **Pejlo** med. UID er ikke Traccar-ID og ikke din e-mailadresse. Kun den konto får knappen til at klargøre trackere.

Token skal kun indtastes i Cloudflare, aldrig i GitHub eller et profilfelt. Der er intet token indbygget i pakken.

Den delte kortnøgle `MAPTILER_API_KEY` bliver stående under **Builds → Variables and secrets** som før. Den bruges under build til kortene.

Testserveren er fortsat `https://demo3.traccar.org`; ingen ny Traccar-server skal lejes eller oprettes.

## 3. Upload og deploy

Upload hele pakkens indhold til roden af det eksisterende GitHub-repository `driftportal-platform/Pejlo`. Erstat filer ved samme navn. Behold den rettede `wrangler.jsonc`.

Cloudflare bygger med `npm run build` og udgiver med `npx wrangler deploy` som hidtil. Databasen bindes som `DB` gennem konfigurationen.

Eksisterende profiler og login bevares. Firestore-reglerne er de samme som før. D1-registeret er serverens autoritative ejerregister; en ændring af et profilfelt giver aldrig adgang til en anden brugers tracker.

## 4. Klargør jeres første tracker i Pejlo

Log på Pejlo med administratorkontoen. Opret en profil, hvis kontoen er tom. Gå til **Indstillinger → Trackerforbindelse → Administrator: klargør tracker**.

Indtast tracker-ID `080608317309` (behold det første nul) og fx navnet `Pejlo`. Tryk **Opret tracker og parringskode**.

Den eksisterende enhed findes på den nye Traccar-konto; den genbruges. For nye ID'er oprettes en enhed på Traccar-kontoen automatisk. Hvis ID allerede er registreret på en anden Traccar-konto, skal det frigøres dér først.

Gem den viste parringskode med det samme. Den vises kun én gang og lagres kun som SHA-256-hash. Giv ID og kode til trackerens ejer.

## 5. Brugerens forløb

1. Opret konto i Pejlo og bekræft e-mailen.
2. Opret en profil med eget navn og dyre-/genstandstype.
3. Under **Indstillinger → Trackerforbindelse**: indtast ID og parringskode.
4. Tryk **Tilføj tracker til denne profil**.

Trackeren knyttes nu til brugerens konto og profilen. Brugeren skal ikke ind i Cloudflare, Firebase eller Traccar. Koden kan ikke overtage en tracker, der allerede tilhører en anden konto. Ejeren kan genvælge en allerede tilknyttet tracker i profilens rullemenu.

## Hardware og test

Trackeren skal være sat til den fælles server og den rigtige protokol/port. ID + parringskode ændrer ikke trackerens mobilnet- eller serverindstillinger. Jeres Q8_H har allerede accepteret `demo3.traccar.org`, port `5015` via SMS. Registreret protokol: jt808.

Appen henter seneste gyldige GPS-position, batteriprocent hvis oplyst og dagens punkter siden midnat UTC. Opdatering cirka hvert minut. En offline-enhed kan stadig have en gammel position; appen viser positionens alder. Manglende GPS vises som afventende, aldrig som en opdigtet position. Profiler uden tilknyttet tracker har stadig tydeligt mærkede eksempeldata.

Familiedeling, overdragelse mellem konti og generel understøttelse/automatisk konfiguration af alle trackermodeller er ikke med endnu. En mistet parringskode kræver administrativ håndtering; denne udgave har ikke en knap til at nulstille den.

Se `docs/validation.md` for præcis teststatus og begrænsninger.
