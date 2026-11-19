# Pejlo 0.8.51 – mobilplacering og automatisk kortfølgning

## Upload

ZIP-filen indeholder kun nye og ændrede filer med de rigtige mapper. Den inkluderer også opdateringen fra 0.8.50. Pak filen ud, og upload indholdet til roden af dit eksisterende Pejlo-repository. Behold de øvrige filer.

Lad Cloudflare bygge og udgive opdateringen som normalt. Der kræves ingen nye secrets, ændringer af Traccar-serveradressen eller manuelle databasekommandoer. Den nye indstillingstabel oprettes automatisk. Behold din eksisterende MAPTILER_API_KEY i buildmiljøet.

Genindlæs Pejlo efter udgivelsen. Loginskærmen viser version 0.8.51.

## Slå mobilplacering til for en bruger

Åbn Systemadmin → Kunder og abonnementer. Find og vælg brugeren. Under Mobilplacering: markér “Tillad omtrentlig mobil-/Wi-Fi-placering for denne bruger”, og tryk “Gem mobilplacering”. Slå også valget til for din egen konto, hvis du vil teste funktionen.

Adgangen er fra som standard. Valget gælder den valgte bruger, også når vedkommende ser delte trackere. Pejlos server håndhæver valget; det er ikke kun en skjult knap. Fravalg gælder ved næste vellykkede dataopdatering.

**Dette valg styrer adgang og visning i Pejlo. Traccars automatiske Google-opslag styres fortsat af geolocation-indstillingerne i traccar.xml. At slå funktionen fra for en bruger stopper ikke disse opslag eller deres eventuelle pris.**

## Det viser kortet

- Gyldig GPS har førsteprioritet. Mobil-/Wi-Fi-estimatet vises, hvis GPS mangler eller er mere end fem minutter gammel, og estimatet er nyere.
- Estimatet skal være højst fem minutter gammelt og have en kendt usikkerhedsradius. Det vises med en gul stiplet cirkel og teksten “Omtrentlig mobil-/Wi-Fi-placering”. Markøren angiver cirklens centrum, ikke en præcis placering.
- Når estimatet bliver for gammelt, fjernes det. En eventuel seneste GPS-position vises igen med sin oprindelige alder.
- Estimater indgår ikke i GPS-ruter, historik, afstandsberegning til hjemmet eller områdealarmer. Find-visningens afstand og kompas bruger fortsat seneste GPS-position. De er ikke en vejviser til cirklens centrum.
- Ved opgraderingen skifter GPS-filteret til en separat GPS-cache, så et tidligere gemt mobilestimat ikke genbruges som GPS. Der kan kortvarigt stå “Ingen position”, indtil der kommer GPS eller hentes gyldig GPS-historik.

## Kortet følger trackeren

“Følg trackeren på kortet” er slået til, når profilen åbnes. Nye positioner flytter kortets centrum og bevarer det valgte zoom. Ved skift mellem GPS og mobilestimat tilpasses zoom til positionstypen.

Trækker du selv kortet, pauses følgningen. Tryk på centrér-knappen eller markér feltet igen for at fortsætte. “Vis hele ruten” pauser også følgningen. Kortet flytter sig ikke automatisk, mens du tegner eller vælger hjemmeområde.

## Interval og afprøvning

Appen henter normalt nye data 15 sekunder efter seneste svar; under Find er intervallet 10 sekunder i den aktive periode. Hele dagens rute hentes cirka én gang i minuttet. Kortet flytter markøren ved nye data. Trackerens eget sendeinterval bestemmer, hvor ofte der findes en ny position – de viste logs havde cirka 30 sekunder mellem GPS-rapporter.

Efter upload: aktivér mobilplacering for din egen bruger, kontrollér en frisk GPS-position udendørs, og prøv derefter et sted uden GPS. Mobilvisning kræver, at Traccar faktisk leverer en ny Google-position med approximate=true og en positiv accuracy. Udgivelsen er testet med automatiske tests og simulerede svar; et vellykket Google-opslag fra den fysiske tracker er endnu ikke bekræftet.
