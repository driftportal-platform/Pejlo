# Pejlo 0.4 – start her

Denne version tilføjer personligt login og privat profillagring til dit eksisterende Pejlo-repository. Cloudflare er fortsat vært for appen; Firebase håndterer login og profiler.

## 1. Firebase Authentication

Åbn projektet **Pejlo (pejlo-a1fed)** i Firebase Console.

1. Åbn Authentication, og vælg Get started, hvis den vises.
2. Under Sign-in method: aktivér **Email/Password**. Gem.
3. Under Settings → Authorized domains: tilføj **pejlo.driftportal-platform.workers.dev** uden https eller skråstreg.

Brugeren skal bekræfte sin e-mail, før appen giver adgang til profillagring. En knap i appen kontrollerer bekræftelsen. Firebase sender selve mailen. Appens webkonfiguration er allerede indsat i `apps/web/src/config/firebase.js`; det er almindelig offentlig klientkonfiguration, ikke en administratornøgle.

## 2. Cloud Firestore og regler

1. Åbn Cloud Firestore under Databases & Storage.
2. Opret en **Standard**-database med database-ID **(default)**. Vælg produktionsregler og en passende EU-placering. Kontrollér placeringen før oprettelse; den kan ikke ændres på den eksisterende database.
3. Åbn fanen Rules.
4. Erstat reglerne med **hele indholdet af firestore.rules** fra denne pakke, og tryk Publish.

GitHub-upload og Cloudflare-build udgiver IKKE Firebase-reglerne. De skal udgives særskilt i Firebase Console. Brug ikke åbne testregler.

Reglerne tillader kun en verificeret bruger at hente og ændre sit eget dokument: `users/{uid}/private/state`. Andre konti har ingen adgang. Der gives ikke tilladelse til at liste brugere. Familiedeling er endnu ikke implementeret.

## 3. Opdatér GitHub

Pak ZIP-filen ud, og upload hele indholdet til **driftportal-platform/Pejlo**. Erstat de gamle filer. `package.json`, `wrangler.jsonc`, `apps` og `dist` skal ligge i repositoryets rod; upload ikke ZIP-filen eller en ekstra omsluttende mappe.

Cloudflare-indstillingerne er fortsat:

- Build: `npm run build`
- Deploy: `npx wrangler deploy`
- Worker-navn: `pejlo`
- Root: repositoryets rod

## 4. Afprøv login og profiler

1. Vent på en vellykket Cloudflare-udgivelse, og åbn https://pejlo.driftportal-platform.workers.dev.
2. Genindlæs med Ctrl+F5, hvis den gamle udgave vises.
3. Vælg Opret konto med din egen e-mail og mindst 10 tegn i adgangskoden.
4. Åbn bekræftelsesmailen; se også i spam. Vend tilbage til appen, og tryk Jeg har bekræftet min e-mail.
5. Opret selv den første profil. Der er ingen Loui-profil fra start.
6. Log ud og ind igen: profilen skal komme tilbage. Samme konto på en anden enhed skal vise samme profiler. En anden konto skal starte tomt.
7. Gamle profiler fra denne browser kan importeres aktivt fra velkomstsiden eller Indstillinger. De importeres aldrig automatisk til en konto.

Profiler og kortnøgle gemmes på kontoen. Husk mig bruger vedvarende login på enheden; ellers gælder login for browsersessionen. Ved kontoskift ryddes den viste profiltilstand. Ingen profil åbnes fra lokal cache, før serveren har svaret. Ved mistet forbindelse sættes redigering på pause. Gemning bruger revisionstjek; en samtidig ændring vises i stedet for at blive overskrevet i stilhed. Ved en gemmefejl vises en besked, og seneste servertilstand gendannes.

Hvis profillagring ikke åbner: kontrollér Firestore, publicerede regler og e-mailbekræftelsen, og tryk Prøv forbindelsen igen. Hvis login fejler: kontrollér Email/Password og Authorized domains.

## Kort og trackerstatus

Alle trackerpositioner, ruter og batterital er EKSEMPLER. Denne udgave modtager ingen data fra Q8 eller andre fysiske trackere. Familieroller og invitationer kommer senere.

Uden MapTiler-nøgle vises et lokalt skematisk eksempel, ikke et geografisk kort. En offentlig MapTiler-nøgle kan gemmes under Indstillinger og bør begrænses til dit domæne. Kontrollér udbyderens abonnement og kvoter.

Find-skærmen bruger efter tilladelse mobilens GPS og eventuelt kompas. Afstanden er i fugleflugtslinje til et eksempelpunkt, ikke en gangrute. Automatisk zoom tager højde for GPS-usikkerhed. Mobilplacering og kompas stoppes, når søgesiden forlades eller appen skjules.

## Verifikation og begrænsninger

14 automatiske tests består for geoberegninger, profilvalidering, migrering, kontoskift og revisionskonflikter. Loginvisningen kontrolleres i browseren. Der er ikke oprettet testkonti eller sendt mails fra udviklingsarbejdet. Firebase-regler og det samlede login-/lagringsforløb er endnu ikke valideret mod dit aktive Firebase-projekt eller en emulator; gennemfør derfor trin 4 før brug med vigtige data.

Kildekode: apps/web/src. Fælles geoberegninger: packages/shared. `npm test` bygger dist og kører tests. Firebase-regler: firestore.rules. Firebase CLI-konfiguration: firebase.json og .firebaserc.
