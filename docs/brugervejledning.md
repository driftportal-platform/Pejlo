# Pejlo brugervejledning til version 0.8.58

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

