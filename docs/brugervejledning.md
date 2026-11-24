# Pejlo brugervejledning til version 0.8.66

Opret en konto og bekræft e-mailen. Opret en profil med navn og eventuelt foto. Under Indstillinger → Trackerforbindelse tilføjes en klargjort tracker med unikt tracker-id og parringskode. En profil uden tracker viser tydeligt mærkede eksempeldata.

## Kort og Find

Kortet viser seneste godkendte GPS-position med dens alder. Online betyder kontakt til serveren og garanterer ikke GPS. Appen spørger normalt hvert 15. sekund efter seneste svar; ved aktiv Find-periode hvert 10. sekund. Den fysiske tracker bestemmer, hvornår der kommer nye målinger.

Følg trackeren på kortet holder centrum ved nye positioner. Manuel trækning pauser det. Centrér-knappen slår det til igen. Find kan bruge telefonens placering og kompas med din tilladelse. Afstand og retning er i fugleflugtslinje og viser ikke en gangrute.

## Mobilplacering

Admin kan tillade omtrentlig mobil-/Wi-Fi-placering pr. bruger. Valget er fra som standard. Ved manglende eller gammel GPS kan et frisk estimat vises med usikkerhedscirkel. Det er ikke en præcis position og indgår ikke i GPS-ruter eller områdealarmer. Find bruger stadig GPS. Fravalg i Pejlo stopper ikke Traccars Google-opslag.

## Hjemmeområde og beskeder

Gem en cirkel eller polygon under Indstillinger og aktivér overvågningen. Standardmargen er 5 m; to friske GPS-punkter skal bekræfte en passage. På iPhone tilføjes Pejlo til hjemmeskærmen, hvorefter beskeder aktiveres og testes derfra. Pauser på 1, 4 eller 12 timer gælder dine egne beskeder. Alarmarkivet ligger under Ture.

## Familiedeling og historik

Ejeren inviterer en anden bekræftet e-mail og vælger læse- eller redigeringsret. Delte brugere bruger eget login. Under Ture kan perioden vælges efter danske datoer; historikken afhænger af den aktive Traccar-server. Servervalg flytter ikke rå historik mellem servere.

## Administrator

På /admin/ administreres kunder, aftaler og tilladelse til mobilplacering. Under Traccar-forbindelse testes og aktiveres serveren for hele Pejlo. Se den tekniske driftsvejledning før IP- eller serverskift. Gem nøgler i en privat kopi af dens register.


## Hurtig Wi-Fi-opsætning i 0.8.58

Åbn Indstillinger → Profil → Hjemmets Wi-Fi, eller brug Åbn Wi-Fi-opsætning på Wi-Fi-kortet i trackerdetaljerne.

1. Læg trackeren inde og tryk Start – trackeren er inde. Flyt den gerne mellem et par rum, mens appen er åben. Guiden tæller tre nye, forskellige scanninger og gemmer dem automatisk.
2. Har du allerede valgt hjemmets punkter, genbruges de. Ellers foreslås op til tre punkter, der var med i alle tre scanninger og havde et gennemsnit på mindst -75 dBm. Bekræft hjemmets punkter én gang; fjern eventuelle nabopunkter. Signalstyrken alene kan ikke afgøre ejerskab. Der bruges ingen adgangskode.
3. Når indemålingerne er gemt, flyttes trackeren udenfor nær huset. Tryk Trackeren er nu ude. Guiden gemmer de næste tre passende scanninger automatisk.

Der er mindst 20 sekunder mellem accepterede målinger. Den faktiske varighed afhænger af, hvornår trackeren sender Wi-Fi-data. GPS- og mobilkontakt kan godt være friske, mens Wi-Fi-scanning mangler. Der sendes ingen ny kommando til at tvinge en scanning. Et enkelt manglende eller gammelt signal bliver ikke tolket som udendørs ophold.

Hold appen åben. En ufærdig måleserie holdes kun i hukommelsen, og indsamlingen standser efter 15 minutter pr. del. Allerede gemte indemålinger bevares, og Fortsæt – trackeren er nu ude kan bruges ved genåbning. Gemmefejl kræver Prøv gemning igen. Hvis de gemte inde/ude-mønstre ligner hinanden, viser guiden det og foreslår at gentage med et andet sted udenfor. Manuel opsætning og ekstra målinger findes i det sammenfoldelige afsnit nedenunder.

Genopsætning erstatter den gamle indlæring: først med den nye inde-del, senere med begge dele. Batteriautomatik vurderer derfor usikkert, indtil begge dele er gemt og et aktuelt signal kan skelnes. Guiden slår ikke batteriautomatik til; det sker særskilt under Tracker.

## Batteri og opdateringer i 0.8.57

Under Indstillinger → Tracker kan ejeren sende 30, 60 eller 120 sekunder til en online tracker. Et manuelt valg slår automatik og tidsbegrænset Find fra. Sidst ønsket interval er ikke en bekræftelse på aktiv trackeropsætning.

Afprøv automatisk batterisparetilstand hjemme med Gem automatik, efter at mindst tre Wi-Fi-målinger inde og tre ude er gemt under Profil. Automatik vælger 120 sekunder ved et stabilt, friskt hjemmemønster og 60 ved usikkerhed eller et udemønster. Det er vejledende og skal afprøves under opsyn.

Find i batteriafsnittet ønsker 30 sekunder i 5 eller 15 minutter. Serveren vender tilbage til automatik eller det tidligere manuelle interval. Afslut Find nu stopper perioden tidligere. Serveren kontrollerer cirka hvert minut, også med lukket app; offline udsætter tilbagevendingen. Tryk Hent seneste intervalønske for ny status. GPS-dvale er endnu ikke aktiveret. Find kan ikke garantere opvågning eller et nyt GPS-fix.

Hent batterihistorik for de seneste 24 timer eller 7 dage for at sammenligne rapporteret batteriprocent, opladning og antal gemte positioner pr. periode. Manglende batterital står tomme. Heartbeats og appopslag indgår ikke i antallet. Appens egne intervalændringer vises særskilt fra denne version. Se [Batteristyring og kommandoer](batteri-og-kommandoer.md) for afprøvede funktioner, aktivering og begrænsninger.


## Automatisk positionsforespørgsel fra 0.8.59

Under Indstillinger → Tracker → Batteri og opdateringer findes Bed automatisk om en ny position. For godkendte trackere med tilknyttet profil er 15 minutter standard. Ejeren kan slå fra eller vælge 10 minutter og trykke Gem positionskontrol. Hent status for positionskontrol viser seneste kontrol og forsøg.

Serveren kontrollerer cirka hvert minut, også når appen er lukket. Gammel godkendt GPS eller gammel kontakt kan udløse en forespørgsel, hvis Traccar viser trackeren online. Offline afventer genforbindelse; der sendes ingen SMS. Manglende signaldata alene udløser ikke en forespørgsel. Nye trackere uden GPS-/kontaktoplysninger venter først den valgte periode.

Der er mindst 15 minutter mellem automatiske forsøg, også hvis grænsen er valgt til 10 minutter. Efter tre forsøg i træk holdes pause. Frisk godkendt GPS og kontakt nulstiller perioden. Fra/til med Gem kan også starte en ny periode. Manuelle positionsforespørgsler og automatiske deler den eksisterende minutbegrænsning.

Forespørgslen bruger Traccars enkeltpositionskommando med ønsket Ingen kø. Afsendelse er ikke bevis for modtagelse, opvågning eller nyt GPS-fix. Hvis Traccar alligevel melder kommandoen i kø, vises dette som uafklaret levering. Funktionen ændrer ikke rapporteringsinterval, tidszone, Wi-Fi-opsætning eller dvaleparametre. Indendørs kan GPS fortsat mangle.

## Motion og hvile fra 0.8.60

Vælg en profil af typen Kat, Hund, Hest eller Andet dyr og åbn Ture. Motion og hvile vises øverst; den skjules for bil, cykel og andre genstande. Manuel registrering virker med personligt login også uden en tracker.

- Vælg et valgfrit dagligt kilometermål og tryk Gem mål. Et tomt mål fjerner det. Målet er dit eget valg og ikke et dyrlægeordineret krav.
- Registrer Samlet kilometer for dagen, Observeret hvile i timer og eventuelt en note. Tomme talfelter betyder ukendt, mens 0 er en udtrykkeligt registreret nulværdi. Gem dag gemmer en samlet dagspost; gentagen gemning opdaterer dagen og lægger ikke ekstra kilometer til.
- Vælg en fra-/til-periode på højst 31 dage og tryk Hent motionshistorik. Der kan vælges ældre perioder efter behov. Rediger-knappen på en række åbner den dag. Dagsregistreringer redigeres inden for den hentede periode.
- Har profilen en tracker, hentes GPS-estimater automatisk sammen med motionshistorikken. Opdatér GPS-oversigt prøver igen ved fejl. Tom historik og fejl under hentning vises hver for sig. En manuel kilometerværdi har forrang i periodens samlede distance og lægges ikke oven i GPS-afstanden.
- Hent CSV eksporterer den viste oversigt med separate kolonner for manuelt/GPS, valgt distance, observeret hvile, GPS-ro, dækning, historisk mål og note. CSV bruger semikolon, UTF-8 og decimalkomma.

Mål ved første registrering er det mål, der var valgt, da dagen første gang blev gemt. Senere målændringer ændrer ikke denne historiske værdi. Fremdrift for i dag sammenlignes med det nuværende mål. Tomme historikdage bliver ikke til 0 km eller hvile.

Observeret hvile er noget, du selv registrerer. Ro ved GPS-sted er kun et estimat for korte intervaller med under 10 meters forskel mellem godkendte GPS-punkter. Katten kan stadig bevæge sig på et lille område eller være vågen. Appen måler ikke søvn og beregner ikke hvile som 24 timer minus bevægelse. GPS-dækning er kun tiden mellem brugbare punkter. Huller over fem minutter, usandsynlige hastigheder og forbindelser over dansk midnat medregnes ikke. Afstanden kan både mangle bevægelse og påvirkes af GPS-udsving.

Ejere og delte redaktører kan registrere data. Læsebrugere kan se og eksportere den fælles historik. Ændringer beskyttes med revisioner; ved en konflikt skal historikken hentes igen, før der gemmes. Hvis en redaktør forlader en delt profil, beholdes historikken hos ejeren. Når ejeren fjerner profilen, slettes motionshistorikken også. Kontosletning sletter ejerens motionsdata.

Vejledningen følger dyretypen. For katte anbefales korte lege med pauser uden ét fast kilometermål for alle katte. Hundes behov afhænger blandt andet af race, alder og helbred. Heste har behov for bevægelsesmuligheder, fold og social kontakt. Andet dyr dækker mange arter og får derfor ingen numerisk standard. Brug dyrlægens råd ved individuelle helbredsbehov. Kildelink vises i appen.


## Profillagring og dagstal fra 0.8.62

Firebase bruges fortsat til login. Profiler, små profilbilleder, kontoens aktive profilvalg, deling og motionsregistreringer ligger nu i Cloudflare D1. Fælles trackerprofiler har én autoritativ profil, så en gammel privat kopi ikke ændrer navn eller område tilbage. GPS-ruter gemmes fortsat hos Traccar.

Ved første login overføres de gamle Firestore-profiler én gang. En kopi af det gamle profildokument gemmes i D1, og Firestore-dokumentet slettes ikke. Hentefejl stopper overførslen, så gamle profiler ikke erstattes med en tom konto. En overført konto læser og skriver derefter sine profiler i D1. Genåbn appen på alle dine enheder efter opdateringen; en gammel, åben udgave bruger fortsat det tidligere lager.

Profiler kontrolleres hvert minut, mens appen er synlig. Uændrede profiler overføres ikke igen. Ved manglende forbindelse sættes redigering på pause. Samtidig gemning på flere enheder giver en konfliktbesked frem for at overskrive den andens ændringer.

GPS-oversigten under Motion og hvile bruger dagstal beregnet på serveren. Tallene gemmes i D1 og genbruges; selve ruten behøver ikke blive sendt til telefonen. I dag opdateres efter højst cirka to minutters genbrug, afsluttede dage efter et døgn ved næste hentning. Ved dansk midnat genberegnes den afsluttede dag, selv om seneste hentning var kort før midnat. Ændring af server, dyretype eller hjemmeområde gør de gamle beregninger forældede. Der beregnes ved åbning/hentning af motionsoversigten, ikke via en ny baggrundsplan.

Afstand, brugbar GPS-dækning og GPS-ro er forskellige tal. Manglende punkter er ukendte, ikke nul motion eller hvile. Observeret hvile registreres fortsat manuelt. Automatisk normalniveau og adfærdsadvarsler er ikke aktiveret i denne version.

## Opladning og ruter fra 0.8.64

For kat, hund, hest og andet dyr udelades historiske punkter, hvor trackeren udtrykkeligt rapporterer opladning. Ruten forbindes ikke hen over opladningen, og punkterne tæller ikke som GPS-kilometer, GPS-dækning eller GPS-ro. Opladning er heller ikke målt hvile for dyret. Manglende opladningsstatus eller 100 procent batteri alene er ikke nok til at udelade et punkt. Bil, cykel og genstande beholder deres punkter.

Under Ture kan du vælge Vis også punkter under opladning (kontrolvisning). Her kan GPS-udsving under opladning igen ses og indgå i den viste rutedistance. Motionsoversigten udelader dem fortsat. Valget nulstilles ved rydning eller profilskift. De oprindelige Traccar-data slettes ikke. Eksisterende GPS-dagstal genberegnes ved næste hentning, fordi beregningsmetoden er opdateret.

Historiske fejl i enhedens tidszone rettes ikke af dette filter. Punkter uden registreret opladning kan derfor stadig ligge på et forkert tidspunkt.

## Hurtigt overblik og grafer fra 0.8.65

Motion og hvile viser to kompakte statusfelter: kilometer mod dit valgte mål og registrerede hviletimer ud af døgnets 24 timer. Uden målinger vises Ukendt; et tomt felt bliver ikke til nul. Ved en historisk periode vises den sidste dag i perioden og dens gemte mål, hvis der findes et. Den valgte profils navn bruges automatisk.

Tryk på en overskrift med plus for at åbne grafer, mål, dagsregistreringer, dagstal, rutehistorik eller alarmarkiv. Tryk igen for at lukke. Registrering og kontrol af dagstal virker stadig, når felterne åbnes. Rediger på en dagsrække åbner automatisk dagsregistreringen. Graferne kan åbnes uden at vise alle dagstabeller; tryk i grafen for at læse den nærmeste værdi. Ukendte dage er markeret med en streg. Tastaturfokus kan også læse datapunkterne.

Batterigrafen findes under Indstillinger → Tracker → Batterigraf, målinger og kommandolog. Historikken hentes, når feltet åbnes. Vælg 24 timer eller syv dage; orange målepunkter viser opladning. Rapportgraf og måletabel samt kommandolog åbnes hver for sig. Huller i batterimålingerne forbindes ikke af grafen. Det er rapporteret batteriniveau, ikke målt strømforbrug.

Under Profil kan du markere, om trackeren er påsat dyret/genstanden, taget af eller ukendt. Gem profilen for at bekræfte. Tidspunktet gemmes med trackerens ID, og bekræftelsen nulstilles ved trackerskift. Valget beskriver den aktuelle brug; det er ikke en fuld historik over på- og aftagning og omskriver ikke gamle hviletal.

Hvile redigeres fortsat som dagens samlede tal; en rettelse erstatter den tidligere registrering. Automatisk hvile fra dvalerapporter er ikke aktiv i 0.8.65. Den nuværende Traccar-dekoder gemmer Loui-trackerens korte 0210-pakke som batteri og tid uden særskilt dvalefelt. Online-status, manglende GPS og en bekræftet påsat tracker er derfor ikke i sig selv tilstrækkeligt til automatisk hviletid. Når dvaledata er tilgængelige, er det ønskede princip ét redigerbart dagstal med et automatisk estimat som udgangspunkt og en manuel rettelse som erstatning.

## Seneste dvalerapport fra 0.8.66

Trackeroplysninger viser Dvalerapport modtaget, Sender rapporter eller Dvalestatus ukendt. Kun én overskrift vises ad gangen; dato/tid for seneste dvalerapport står nedenunder. En dvalerapport er frisk i højst 15 minutter. En fuld rapport viser blot rapportering, ikke at dyret er vågent; heartbeats bekræfter kun kontakt. Offline og gamle/ukendte målinger bliver ikke til bekræftet dvale.

Funktionen kræver statuslæseren og Cloudflare-nøglen i [installationsvejledningen](version-0.8.66.md). Appen alene kan ikke læse serverens rå log. Der ændres ikke noget i trackerens indstillinger, og der beregnes endnu ikke automatisk hviletid.
