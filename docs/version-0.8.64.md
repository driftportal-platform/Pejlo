# Pejlo 0.8.64 – opladning skal ikke ligne en gåtur

Upload ændringspakken oven på 0.8.63 med samme mapper, og lad det normale GitHub/Cloudflare-build udgive både API og web. Genåbn PWA, og kontrollér version 0.8.64. Pakken er ikke udgivet automatisk. Ingen nye Firebase-indstillinger, Cloudflare-bindings, secrets, cron-planer eller manuelle databasekommandoer kræves. Behold MAPTILER_API_KEY i buildmiljøet.

## Hvad nattens data viser

De modtagne 0704-beskeder kl. 06:33–06:34 indeholder flere gemte positionsrapporter. Feltet efter antal poster er 01, som angiver genindsendelse af gemte målinger. Modtagelsestid og måletid er derfor forskellige.

I E4-feltet er første byte strømstatus og anden byte batteriprocent. E4 02 00 64 betyder ekstern strøm/opladning og 100 procent; E4 02 01 64 betyder batteridrift og 100 procent. Det følger leverandørens [JT808-protokol V1.12](https://api.zbiot.cc/public/pdf/JT808%E5%8D%8F%E8%AE%AEV1.12.pdf).

Den indsendte historik har ekstern strøm ved målingen dateret kl. 06:18:34 og batteridrift ved kl. 06:22:16 i det tidligere viste Traccar-udtræk. Det indsnævrer et skift mellem de to målinger; det er ikke en måling af det præcise tidspunkt, hvor opladeren blev fjernet. De rå BCD-tider i disse poster er henholdsvis 261124131834 og 261124132216, fortolket med den tidszone, som blev brugt til natposterne.

Der findes også særskilte morgenmålinger modtaget kl. 08:30–08:40, som blev tidsstemplet kl. 00:30–00:40. Disse må ikke automatisk anses for natlig opladning. Denne version omskriver ikke historiske tidsstempler eller Traccars tidszone.

## Ny adfærd

- For kat, hund, hest og andet dyr udelades historiske GPS-punkter med Traccars udtrykkelige charge=true fra ruter og motionsoversigt. Dette gælder også tidligere dage, hvis de gemte rapporter har feltet.
- Der tegnes ikke en forbindelseslinje og beregnes ikke distance hen over en registreret opladningsperiode. Også en opladningsrapport med ubrugelig GPS kan afbryde forbindelsen mellem brugbare punkter.
- Opladning tæller hverken som GPS-dækning, GPS-ro eller observeret hvile. Appen kan ikke udlede dyrets hvile af, at trackeren ligger til opladning.
- Et fuldt batteri alene, charge=false eller manglende strømstatus fjerner ikke et punkt. Bil, cykel og genstande beholder deres ruter, da de kan bevæge sig med ekstern strøm.
- Ture får valget **Vis også punkter under opladning (kontrolvisning)** for dyreprofiler. Kontrolvisningen viser punkterne igen og advarer om, at rutedistancen kan omfatte GPS-udsving. Den ændrer ikke motionsoversigtens beregning. Valget nulstilles ved rydning/profilskift.
- De gamle GPS-dagstal i D1 genberegnes ved næste hentning med en ny beregningsversion. Manuelle registreringer, profiler, rå Traccar-historik, seneste position og live batteristatus bevares. Der sendes ingen nye kommandoer til trackeren.

Filteret forudsætter, at charge-attributten er gemt korrekt af Traccar. Det reparerer ikke punkter med manglende strømstatus eller forkerte datoer. En tracker, som bæres af et dyr under opladning, får også sine opladningspunkter udeladt; kontrolvisningen kan bruges til at se dem.

## Kontrol

Build og alle 309 tests er bestået. Regressionstests dækker opladning/ukendt strømstatus, uændrede genstandsprofiler, bevaret live telemetri, kontrolvisning, profilskift, afbrudte ruter og GPS-dækning samt genberegning af gamle dagstal.

Efter udgivelse: vælg Loui under Ture, hent 24. november, og kontrollér antallet af udeladte opladningspunkter. Slå kontrolvisningen til og fra. Hent derefter motionshistorikken igen. Gamle fejlplacerede morgenpunkter kan stadig ses, da tidszonefejlen er et separat problem. Fysisk kontrol i den udgivne PWA er ikke udført her.
