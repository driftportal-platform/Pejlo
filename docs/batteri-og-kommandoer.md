# Batteristyring og kommandoer

Pejlo 0.8.57. Opdateret 24. november 2026. Kommandoerne her er knyttet til den afprøvede Q8_H med JT808-id 080608317309. De må ikke kopieres til andre tracker-id'er.

## Funktioner i appen

Under Indstillinger → Tracker → Batteri og opdateringer kan ejeren vælge Detaljeret 30 sekunder, Normal 60 sekunder eller Batterispare 120 sekunder. Vælg Anvend på tracker for at sende. Alle tre intervaller er afprøvet på Loui-trackeren. 120 sekunder kræver stadig bekræftelse, fordi batterigevinsten ikke er målt. Længere interval giver færre gemte punkter; batterigevinsten skal måles.

Knapperne ændrer ikke noget ved åbning af siden. Appen sender F115 som en raw JT808 custom-kommando med Ingen kø og en serverberegnet checksum. Kun ejer og eksplicit godkendte trackere har skriveadgang. Offline trackere afvises, og der skal gå mindst 60 sekunder mellem afsendelser. Traccars HTTP-svar er ikke en kvittering fra trackeren. Sidst ønsket interval og afsendelsesstatus vises; appen hævder ikke at have læst det aktive interval tilbage.

Automatik aktiveres med Gem automatik. Det kræver mindst tre gemte inde- og tre udemålinger af de valgte Wi-Fi-punkter under Profil. Serveren vælger 120 sekunder efter tre forskellige friske indendørsmønstre over mindst to minutter. Målinger må højst være to minutter gamle; en pause på mere end tre minutter nulstiller serien. Ude, manglende eller usikre signaler giver 60 sekunder. Et indendørsmønster beviser ikke, at Loui er inde. Automatik er en afprøvning og starter ikke ved upload.

Find-knappen i batteriafsnittet vælger 30 sekunder i 5 eller 15 minutter. Ved udløb vender serveren tilbage til automatik eller det tidligere manuelle interval (60 hvis intet var registreret). Afslut Find nu fremskynder tilbagevendingen. Serverens minutkontrol virker med lukket app. Offline udsætter tilbagevendingen til forbindelse igen; kø bruges ikke. Mindst ét minut mellem kommandoer gælder også her. Manuelt intervalvalg slår automatik og Find fra. En uafklaret afsendelse gentages ikke blindt: kontrollér log og interval, og vælg derefter manuelt. Udløb af Find kan stadig forsøge det normale interval én gang, selv om Find-afsendelsen var uafklaret. Hent seneste intervalønske opdaterer status.

Find ændrer intervalønsket; det er ingen garanti for et nyt GPS-fix eller opvågning. Funktionen er særskilt fra appens eksisterende Find-visning og polling. GPS-dvale er ikke aktiveret. Tidligere observerede pauser med femminutters-heartbeats viser fortsat kontakt; de dokumenterer ikke GPS-modulets strømtilstand. Ukendte dvaleparametre ændres ikke.

## Aktivering i Cloudflare

I Workers & Pages → pejlo → Settings → Variables and Secrets oprettes en almindelig runtime-variabel:

| Navn | Værdi for Loui |
| --- | --- |
| PEJLO_BATTERY_DEVICES | 080608317309 |

Flere afprøvede id'er adskilles med komma. Et godkendt id skal være 12 cifre til denne kommandoopbygning. Bevar eksisterende variabler og secrets, især aktivt Traccar-servervalg, token og MAPTILER_API_KEY. Udgiv både API og web efter upload. Der kræves ikke en manuel database-migration; D1-tabellerne oprettes ved første relevante brug. Eksisterende minut-cron i wrangler.jsonc bruges også til batteriautomatik. Bevar denne trigger, ellers sker automatisk tilbagevending ikke.

## Historik og antal rapporter

Vælg Seneste 24 timer eller Seneste 7 dage og tryk Hent batterihistorik. Appen henter Traccars gemte positionshistorik via /api/reports/route og viser sidste rapporterede batteriprocent og opladningstilstand pr. time eller døgn, samt antal gemte positioner. Data kan hentes for perioder, hvor appen var lukket, hvis Traccar har gemt dem. Ukendte målinger forbliver tomme. Der interpoleres ikke hen over manglende data, og ingen procent pr. døgn eller resterende driftstid beregnes.

Antallet er IKKE alle trackerens netværkskald. Heartbeats, afviste pakker, kommandoer, intern GPS-søgning og Pejlos API-opslag tælles ikke som positioner. Batteriværdier kan være gentaget i flere rapporter; de beviser ikke en ny fysisk batterimåling hver gang. Der tælles højst 10.000 returnerede poster; ved flere poster markeres resultatet som ufuldstændigt. Eksporter og sletning i Traccar kan påvirke tilgængelig historik.

Intervalændringer fra appen logges fra 0.8.56, også automatiske ændringer fra 0.8.57 med ønsket interval, tidspunkt og afsendelsesstatus. Der vises højst 100 intervalhændelser i den valgte periode. Manuelle Traccar-/SMS-kommandoer og ændringer foretaget før denne version indgår ikke. Logs er opdelt efter Traccar-serverkilde. Historikken siger ikke i sig selv, at den ønskede indstilling trådte i kraft.

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

24. november ændrede mønstret sig: pakker ved 00:19 brugte fortsat GMT+8, mens pakken modtaget 06:33:57 indeholdt 05:33:55 (UTC). Med decoderens GMT+8-standard blev denne tid behandlet otte timer for tidligt. Serveren sendte 8109 ved forbindelsen både 06:33 og 07:55. Det er ikke bevist, om firmware, netværkstid eller en tidskommando udløste skiftet.

Aktuel indstilling efter rettelsen cirka 08:40 den 24. november: enhedens Tidszone/decoder.timezone = UTC. Efter genforbindelse 08:42 og 08:44 lå den afkodede tid cirka fire sekunder bag logtidspunktet. Behold denne indstilling, og kontrollér næste genforbindelse; rettelsen er endnu ikke langtidsafprøvet. Der er ikke grundlag for daglig genstart eller automatisk tidskommando kl. 00:01. Bevar filter.future = 120. Brug friske data efter rettelsen til batteritesten, og kontrollér deviceTime/fixTime mod serverTime før historik sammenlignes.

```bash
date -Is
sudo grep 'id:.*317309' /opt/traccar/logs/tracker-server.log | tail -n 15
sudo grep -Ei 'filtered' /opt/traccar/logs/tracker-server.log | tail -n 25
sudo grep 'jt808' /opt/traccar/logs/tracker-server.log | tail -n 20
```

Konfiguration med tomt Data sender 8104 og læser indstillinger. Det ændrer ikke trackeren. En protokolkvittering for 8103 med resultat 00 betyder succes; kontroller også intervallet i de efterfølgende rapporter. Servergenstart: sudo systemctl restart traccar. En genstart afbryder kort forbindelserne.

## Kilder og status

Fysisk test og rå logs i Loui-projektet 22.–23. november 2026. Leverandørens protokoloversigt, F115: https://api.zbiot.cc/public/pdf/JT808%E5%8D%8F%E8%AE%AEV1.12.pdf . Traccars tidszoneafkodning: https://github.com/traccar/traccar/blob/master/src/main/java/org/traccar/protocol/Jt808ProtocolDecoder.java . Genbekræft ved firmwareændringer. Apppakken er en lokal leverance og er ikke automatisk publiceret.

## Fysisk teststatus 24. november

120 sekunder blev kvitteret 23. november 23:07:26 og læst tilbage 23:07:57 som F115 = 00 0078. Under tur kom ekstra rapporter. Ved stilstand kom rapporter 23:18:26, 23:20:26 og 23:22:26 med 120 sekunders mellemrum, derefter kun heartbeats. Ved senere bevægelse kom GPS-rapporter igen; præcis opvågningstid er ikke målt. Ingen automatisk GPS-dvalekommando er testet.

Trackeren var til opladning natten til 24. november og kom på Loui cirka 06:30. Rapporter på 100 % beviser derfor ikke en batterigevinst. Log afkoblingstid, faktisk interval og senere procentfald før strømforbruget sammenlignes. Hold først øvrige indstillinger faste. Afprøv ny automatik med trackeren under opsyn, og kontroller logs efter udgang fra hjemmet og efter Find-udløb.
