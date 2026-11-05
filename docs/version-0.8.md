# Pejlo 0.8.0

Komplet opdatering af 0.7.5 med foto, søgehjælp og et gemt alarmarkiv. Eksisterende roller, private profiler, familiedeling, cirkler/polygoner, historik, push, mail og ikoner er med.

## Installation

Upload pakkens indhold til det eksisterende GitHub-repository som hidtil. Behold Cloudflares databasebinding, Traccar-token, VAPID-nøgler, Resend-nøgle og MapTiler-buildvariabel. Der kræves ingen nye hemmeligheder eller tjenester.

Workeren opretter selv den nye arkivtabel første gang. Migrationen `apps/api/migrations/0003_alarm_history.sql` følger med til installationer, der administrerer databasen via migrationer. Eksisterende data skal ikke slettes. Behold Cron Trigger hvert minut; uden den registreres der ikke baggrundsalarmer.

Genåbn PWA'en efter deployment. Login og appens versionsmærke viser 0.8.0.

## Foto

Vælg foto under Indstillinger. JPG, PNG og WebP op til 10 MB beskæres i midten til et kvadrat og komprimeres til 128 × 128 pixel JPEG på højst 12.000 tegn. Det gemmes automatisk på profilen og vises også i profilvælgeren og på kortmarkøren. Fotoet kan fjernes igen. Delte brugere ser samme foto; kun ejer og redaktører kan ændre det. Et nyt foto erstatter det tidligere. Der kræves ingen separat billedtjeneste.

## Find og hjemmestatus

- Slå “Hold skærmen vågen” til i Find. Funktionen frigives, når man forlader Find eller lukker/skjuler appen, og anmodes igen ved tilbagevenden til en synlig søgevisning. Browser, batterisparetilstand og telefonen kan afvise eller frigive skærmlåsen; status vises i appen. Funktionen sender ingen kommandoer til trackeren.
- “Seneste kontakt med trackeren” bruger Traccars `device.lastUpdate`. GPS-alderen bruger stadig positionens `fixTime`. Frisk kontakt gør derfor ikke en gammel position frisk. Mangler kontaktfeltet, vises “Ikke oplyst”.
- Positioner over fem minutter gamle beskrives som “Sidst set hjemme” eller “Sidst set uden for hjemmeområdet”. Det er en observation, ikke en bekræftelse på den aktuelle placering.
- Find viser fugleflugtsafstand fra det faste hjemmepunkt til seneste position. Kompaspilen viser fortsat retningen fra telefonen til den seneste position.
- En særskilt tekst viser målt bevægelsesretning fra mindst tre GPS-punkter inden for de sidste tre minutter. Sidste punkt skal være højst fem minutter gammelt; mellemrum over to minutter, spring over 70 m/s, bevægelse under 20 m, utilstrækkelig kendt præcision eller en usammenhængende rute giver “usikker eller ikke tilgængelig”. Ukendt GPS-præcision kan ikke bruges som garanti for retningen. Det er ingen forudsigelse af, hvor Loui er på vej hen nu.
- På Kort kan man vælge 100/250/500 meters afstandscirkler og en linje mellem hjem og seneste position. Begge kræver et bekræftet fast hjemmepunkt og er fra som udgangspunkt. Afstand måles fra hjemmepunktet, også ved polygoner.

## Alarmarkiv under Ture

Arkivet gemmer faktiske hændelser registreret af Workeren, tidspunkt, GPS-tid, den daværende områdegeometri og navn samt push-status. Det ændres ikke, hvis man senere flytter, vælger eller sletter et område. Arkivet starter fra denne opdatering og viser de seneste 90 dage med flere sider, hvis nødvendigt.

Områdeafgang og hjemkomst arkiveres også, hvis den pågældende push-type er slået fra eller push ikke er konfigureret. Batteri og manglende GPS registreres, når den personlige overvågningstype er aktiveret. Ejerbesked om en redaktørs områdeændring gemmes hos ejeren. Hver bruger ser sine registrerede hændelser for trackere, vedkommende fortsat har adgang til. En ny delt bruger får ingen bagudrettet kopi af ejerens arkiv.

“Afleveret til push-tjenesten” betyder, at tjenesten accepterede beskeden; det bekræfter ikke modtagelse eller læsning på telefonen. Stilleperioder, deaktiveret push, manglende opsætning, udløb og mislykkede forsøg vises særskilt. Uden løbende friske GPS-punkter kan Workeren ikke registrere en grænsepassage, der sker og ophører mellem to aflæsninger.

Rutens anslåede passager vises stadig særskilt og er tydeligt mærket som beregnet ud fra det aktuelt valgte område. De er ikke alarmarkivet.

## Invitationsmail

`MAIL_FROM` skal fortsat kun indeholde adressen, fx `pejlo@send.driftportalen.dk`. Koden tilføjer visningsnavnet **Pejlo**. Mailkvoter reserveres atomisk, så samtidige invitationer ikke kan overskride modtagerens grænse. Grænserne gælder afsendelsesforsøg, også hvis mailtjenesten fejler. Afsendernavnet alene garanterer ikke placering i indbakken.

## Afprøvning på telefonen

Efter upload: vælg et foto, genåbn profilen på en anden konto med adgang, prøv skærmlåsen i Find og kontrollér de separate kontakt-/GPS-aldre. Gennemfør den planlagte geofencetest ude og hjemme; sammenlign push med det nye alarmarkiv. Test en invitationsmail med eksisterende Resend-opsætning. Ingen live push eller mail er sendt under den lokale kontrol.
