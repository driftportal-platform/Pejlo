# Pejlo 0.8.56

Bygger på GitHub main 9fabbd29f1ba98146f974ff20a4fa286a8adebae, version 0.8.55.

## Batteristyring

Under Indstillinger → Tracker kan ejeren sende 30 eller 60 sekunders rapporteringsinterval. 120 sekunder er markeret som afprøvning og kræver bekræftelse. Kommandoen bruger det F115-felt, som er fysisk testet med 60 sekunder på Loui-trackeren. Automatisk skift, tidsbegrænset Find og dvale er ikke aktive endnu. Ingen indstilling ændres ved upload eller ved at åbne siden.

## Historik

Batteriprocent, opladningstilstand og antal gemte positionsrapporter kan hentes for 24 timer eller 7 dage. Der er time-/døgnoversigt og særskilt log over appens intervalønsker. Historik kommer fra Traccars gemte poster, også for perioder hvor appen var lukket. Heartbeats, afviste pakker og appens API-kald tælles ikke. Der er ingen automatisk beregning af resterende batteritid. Grænsen på 10.000 returnerede poster markeres tydeligt ved overskridelse.

## Installation og aktivering

Upload ZIP-indholdet til repositoryets rod. Udgiv både API og web i det eksisterende Cloudflare-projekt. Bevar alle eksisterende secrets og kortnøglen i buildmiljøet. Tilføj runtime-variablen PEJLO_BATTERY_DEVICES med værdien 080608317309 for at aktivere intervalstyring på Loui-trackeren, og udgiv igen. Ingen manuel database-migration kræves. Ved flere trackere må kun afprøvede id'er tilføjes, adskilt med komma. Historiklæsning kræver eksisterende trackeradgang, men ikke denne aktivering. API-håndhævet ejerskab kræves ved intervalændringer.

Kontrollér, at appen viser version 0.8.56. Start med Normal 60 sekunder. En besked om afsendelse beviser ikke, at trackerens interval er ændret; kontrollér efterfølgende rapporter. Den oprindelige tidszonerettelse skal bevares, og filter.future skal ikke deaktiveres.

## Dokumentation

README, brugervejledning og teknisk driftsvejledning er opdateret. Den nye [Batteristyring og kommandoer](batteri-og-kommandoer.md) samler F115-pakken, kvittering og fysisk test, aktivering, historikbegrænsninger samt Ubuntu-, Tailscale- og tidszoneoplysninger. Windowsafsnittet i driftsvejledningen er bevaret som historik; den aktuelle Ubuntu-opsætning er tilføjet særskilt.

## Validering

36 målrettede tests består. De dækker den afprøvede hex-pakke og checksum, intervalgrænser, eksplicit godkendelse af trackere, offline/kø/timeout, afsendelsesstatus, profilskift, batterihistorik, optælling, opladning, dataadskillelse og de eksisterende Wi-Fi-/serverstatusfunktioner. Build og syntakskontrol er gennemført. Den fulde testsuite kan ikke gennemføres lokalt, fordi den eksisterende afhængighed @block65/webcrypto-web-push ikke er installeret. Browser og faktisk appstyret afsendelse skal afprøves efter upload. Kør npm ci og npm test i det normale buildmiljø før udgivelse.

Pakken er ikke automatisk lagt på GitHub, og Cloudflare-variablen er ikke oprettet automatisk.
