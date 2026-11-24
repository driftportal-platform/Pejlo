# Pejlo 0.8.65 – kompakt historik og visuelle overblik

Upload ændringspakken oven på 0.8.64 med samme mapper. Lad det normale GitHub/Cloudflare-build køre, genåbn PWA, og kontrollér version 0.8.65. Pakken er ikke automatisk udgivet. Ingen nye Firebase-indstillinger, Cloudflare-bindings, secrets, cron-planer eller manuelle databasekommandoer kræves. Behold MAPTILER_API_KEY i buildmiljøet.

## Overblik uden alle dagstal på skærmen

Motion og hvile beholder et synligt overblik med kilometer og registrerede hviletimer. Kilometer har en statusbjælke mod det valgte daglige mål. Hvilebjælken viser registrerede timer ud af døgnets 24 timer; den er ikke en anbefaling om at nå 24 timers hvile. Manglende værdier vises som Ukendt. Et eksplicit registreret nul vises som nul.

Når perioden indeholder i dag, vises dagens tal. Ellers vises sidste dag i perioden og det mål, der blev gemt ved den dags registrering. Det aktuelle mål bruges ikke som om det var et historisk mål. Navne følger den valgte profil. Funktionen er fortsat kun for dyreprofiler.

Daglige kilometer og registreret hvile har hver sin graf, som åbnes ved tryk på overskriften. Manuel distance har fortsat forrang frem for GPS-afstand. Ukendte dage markeres med en streg og er ikke nul. Datapunkter har værdier til skærmlæser/tastatur; et tryk i grafen viser nærmeste periodes værdi i en tekstlinje. Profiltekst og noter sættes som tekst og indsættes ikke som HTML.

Mål, dagsregistrering, dagstal/målegrundlag, vejledning, rutehistorik og alarmarkiv starter sammenklappede. Tryk på overskriften for at åbne eller lukke. Rediger på en dagsrække åbner dagsformularen. Kortet genberegner sin størrelse, når rutehistorikken åbnes, så Leaflet ikke bliver stående med størrelsen fra et skjult felt. Trackeroplysninger beholder signalkortene synlige og samler de detaljerede målinger under Alle målinger og tidspunkter.

## Batteri og rapporter

Indstillinger → Tracker får Batterigraf, målinger og kommandolog. Historikken hentes ved åbning og ved valg af en anden periode; Hent batterihistorik kan stadig opdatere manuelt. Det tilføjer ingen løbende polling.

Batterigrafen viser seneste måling pr. time ved 24 timer eller pr. døgn ved syv dage. Orange punkter markerer rapporteret opladning. Manglende batterimålinger afbryder linjen. En særskilt, sammenklappelig rapportgraf og måletabel viser antallet af gemte positionsrapporter. Kommandologgen har sit eget felt. De eksisterende begrænsninger på Traccar-historikken gælder fortsat; graferne måler ikke strømforbrug og viser ikke alle rå TCP-pakker.

Gamle svar fra en anden periode/profil kan ikke overskrive de nye grafer. Nulstilling af profilen rydder graferne.

## Bekræft påsat eller taget af

Profilformularen har valgene Ukendt, Påsat og Taget af. Gem profil bekræfter valget med tidspunkt og tracker-ID. Samme gemning med uændret status bevarer det oprindelige tidspunkt. En ny tracker kræver en ny bekræftelse. Bekræftelsen vises også under Motion og hvile og bruger profilens aktuelle navn. Den gemmes i profilens eksisterende lager og overføres med delte profiler. Den opretter ikke en historik over alle på-/aftagninger og gælder ikke bagud som bevis for, at trackeren blev båret.

Ønsket om ét fælles, redigerbart hviletal er fastholdt: en manuel dagsrettelse erstatter dagens tidligere værdi og skal ikke lægges oven i et automatisk estimat. I denne version er automatisk hvile fra dvale endnu ikke aktiveret. Den senest undersøgte [Traccar-dekoder](https://github.com/traccar/traccar/blob/master/src/main/java/org/traccar/protocol/Jt808ProtocolDecoder.java) behandler 0210 med syv bytes body ved at læse batteri og tid og hente seneste position. Den sætter ikke en dvalemarkering på positionen. Online, manglende GPS, 100 procent batteri og en bekræftet påsat tracker alene er ikke nok til automatisk hviletid. Derfor viser graferne registreret hvile, indtil dvaledata faktisk er tilgængelige og kan afgrænses til påsatte perioder uden opladning.

## Kontrol

Build og alle 314 tests er bestået. Nye tests dækker ukendt kontra nul, huller i batterilinjen, kilometer over målet, historisk mål, påsatbekræftelsens binding til tracker og gamle batterisvar efter periode-/profilskift. Mobil layoutkontrol af overblik og grafer er udført i en lokal browservisning med testdata; det er ikke en fysisk test med Loui eller en udgivelse til Pejlo-serveren.

Efter udgivelse: åbn Ture med Loui valgt. Kontrollér de to statusfelter, fold grafer og dagstal ud/ind, og prøv Rediger på en dag. Åbn rutehistorikken og kontrollér kortets størrelse. Åbn batterihistorikken og skift mellem 24 timer og syv dage. Markér Påsat under Profil, gem, og kontrollér navn/tidspunkt under Motion og hvile. Prøv dernæst en anden profil for at kontrollere, at gamle værdier ikke bliver stående.
