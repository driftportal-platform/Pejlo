# Batteristyring og kommandoer

Pejlo 0.8.56. Opdateret 23. november 2026. Kommandoerne her er knyttet til den afprøvede Q8_H med JT808-id 080608317309. De må ikke kopieres til andre tracker-id'er.

## Funktioner i appen

Under Indstillinger → Tracker → Batteri og opdateringer kan ejeren vælge Detaljeret 30 sekunder, Normal 60 sekunder eller Batterispare 120 sekunder. Vælg Anvend på tracker for at sende. De to første intervaller er afprøvet fysisk. 120 sekunder er en testindstilling med særskilt bekræftelse, ikke en afprøvet firmwarefunktion. Længere interval giver færre gemte punkter; batterigevinsten skal måles.

Knapperne ændrer ikke noget ved åbning af siden. Appen sender F115 som en raw JT808 custom-kommando med Ingen kø og en serverberegnet checksum. Kun ejer og eksplicit godkendte trackere har skriveadgang. Offline trackere afvises, og der skal gå mindst 60 sekunder mellem afsendelser. Traccars HTTP-svar er ikke en kvittering fra trackeren. Sidst ønsket interval og afsendelsesstatus vises; appen hævder ikke at have læst det aktive interval tilbage.

Automatisk hjemme/ude-skift, tidsbegrænset Find og GPS-dvale er ikke aktive i denne version. Der er ingen automatisk tilbagevenden fra Detaljeret 30 sekunder; ejeren vælger selv Normal igen. Serverstatus, Wi-Fi-historik og eksisterende alarmer fra 0.8.55 er bevaret.

## Aktivering i Cloudflare

I Workers & Pages → pejlo → Settings → Variables and Secrets oprettes en almindelig runtime-variabel:

| Navn | Værdi for Loui |
| --- | --- |
| PEJLO_BATTERY_DEVICES | 080608317309 |

Flere afprøvede id'er adskilles med komma. Et godkendt id skal være 12 cifre til denne kommandoopbygning. Bevar eksisterende variabler og secrets, især aktivt Traccar-servervalg, token og MAPTILER_API_KEY. Udgiv både API og web efter upload. Der kræves ikke en manuel database-migration; to nye D1-tabeller oprettes ved første relevante brug.

## Historik og antal rapporter

Vælg Seneste 24 timer eller Seneste 7 dage og tryk Hent batterihistorik. Appen henter Traccars gemte positionshistorik via /api/reports/route og viser sidste rapporterede batteriprocent og opladningstilstand pr. time eller døgn, samt antal gemte positioner. Data kan hentes for perioder, hvor appen var lukket, hvis Traccar har gemt dem. Ukendte målinger forbliver tomme. Der interpoleres ikke hen over manglende data, og ingen procent pr. døgn eller resterende driftstid beregnes.

Antallet er IKKE alle trackerens netværkskald. Heartbeats, afviste pakker, kommandoer, intern GPS-søgning og Pejlos API-opslag tælles ikke som positioner. Batteriværdier kan være gentaget i flere rapporter; de beviser ikke en ny fysisk batterimåling hver gang. Der tælles højst 10.000 returnerede poster; ved flere poster markeres resultatet som ufuldstændigt. Eksporter og sletning i Traccar kan påvirke tilgængelig historik.

Intervalændringer fra appen logges fra denne version med ønsket interval, tidspunkt og afsendelsesstatus. Der vises højst 100 intervalhændelser i den valgte periode. Manuelle Traccar-/SMS-kommandoer og ændringer foretaget før denne version indgår ikke. Logs er opdelt efter Traccar-serverkilde. Historikken siger ikke i sig selv, at den ønskede indstilling trådte i kraft.

## Afprøvet kommando til 60 sekunder

I Traccar vælges Brugerdefineret / Custom, nedenstående Data, Ingen kø og SEND mens trackeren er online:

```text
7e810300090806083173090001010000f1150300003c1d7e
```

F115 består af mode 00 (tidsstyret) og WORD 003c (60 sekunder). Kommandoen gav succes-kvittering 23. november kl. 14:43:29. Efterfølgende positionsrapporter blev modtaget 14:44:19 og 14:45:19, præcis ét minut fra hinanden. Appens kommando indeholder en varierende serienummer-værdi, så hele hex-strengen behøver ikke være identisk med eksemplet.

Afprøvet tidligere udgangspunkt er F115 = 00 001e (30 sekunder). Tilbage til 30 sekunder for samme enhed:

```text
7e810300090806083173090001010000f1150300001e3f7e
```

Standardfeltet 0029 blev tidligere sat til 60 og læst tilbage som 60, men rapporteringen fortsatte hvert 30. sekund. Brug derfor F115 på netop denne afprøvede firmware. Dvaleparametre som F117 ændres ikke i appen. Protokoldokumentets intervalgrænse for F115 er 10–120 sekunder; det er ikke dokumentation for, at alle værdier er afprøvet på Q8_H.

## Tidszone og manglende GPS

23. november sendte trackeren nye, gyldige GPS-pakker, men Traccar loggede Position filtered by Future filters. Enhedens decoder.timezone stod til UTC, mens de viste pakker benyttede GMT+8. UTC-egenskaben blev fjernet fra enheden, så JT808's GMT+8-standard blev brugt. Efter genstart kom positionerne igennem, og Pejlo opdaterede igen.

Bevar filter.future = 120. Kontroller tidspunkter efter enhver tracker-/serverændring. At problemer tidligere så ud til at forsvinde omkring kl. 14:30 er ikke fuldt forklaret; det skal kontrolleres, at rettelsen også virker den følgende morgen.

```bash
date -Is
sudo grep 'id:.*317309' /opt/traccar/logs/tracker-server.log | tail -n 15
sudo grep -Ei 'filtered' /opt/traccar/logs/tracker-server.log | tail -n 25
sudo grep 'jt808' /opt/traccar/logs/tracker-server.log | tail -n 20
```

Konfiguration med tomt Data sender 8104 og læser indstillinger. Det ændrer ikke trackeren. En protokolkvittering for 8103 med resultat 00 betyder succes; kontroller også intervallet i de efterfølgende rapporter. Servergenstart: sudo systemctl restart traccar. En genstart afbryder kort forbindelserne.

## Kilder og status

Fysisk test og rå logs i Loui-projektet 22.–23. november 2026. Leverandørens protokoloversigt, F115: https://api.zbiot.cc/public/pdf/JT808%E5%8D%8F%E8%AE%AEV1.12.pdf . Traccars tidszoneafkodning: https://github.com/traccar/traccar/blob/master/src/main/java/org/traccar/protocol/Jt808ProtocolDecoder.java . Genbekræft ved firmwareændringer. Apppakken er en lokal leverance og er ikke automatisk publiceret.
