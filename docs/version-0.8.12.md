# Pejlo 0.8.12 – filter mod GPS-hop

## Virkemåde
Filteret sammenholder afstand og tid fra seneste troværdige position. Et spring på 100 m på 2 sekunder holdes tilbage på katteprofilen. En ny, nogenlunde sammenhængende position mindst 5 sekunder senere kan bekræfte flytningen; gentagelse af samme GPS-tidspunkt tæller aldrig som bekræftelse. Vender trackeren tilbage til den troværdige placering, udelades springet.

Hastighedsgrænser: kat 12 m/s, hund og andet dyr 15, hest 25, cykel og genstand 20, bil 70. Spring på højst 30 m dæmpes ikke af hastighedsreglen. Ved lange pauser begrænses tidsgrundlaget til 30 sekunder; en stor flytning kan derfor kræve bekræftelse. Kandidater kan bekræftes i op til 3 minutter. Rapporteret positioneringsusikkerhed over 100 m holdes tilbage. Manglende usikkerhedsdata er ikke i sig selv en afvisning.

Kort, Find og alder bruger den troværdige position. Ved tilbageholdelse vises »Usikkert GPS-signal«. Rute og anslået distance beregnes af filtrerede punkter; historikkens tæller inkluderer frasorterede GPS-hop. Trackerens seneste kontakt er fortsat separat fra GPS-tiden.

## Baggrundsalarmer og lagring
Samme filter bruges i Cloudflare, før geofence-kontrol. Det fungerer også, når appen er lukket. Filtreringen gemmer én troværdig position og én mulig flytning pr. tracker/ejer i D1 og bruger en versionskontrol mod samtidige opdateringer. Historiske forespørgsler kan ikke tilbagespole filteret. Baggrundskørslen henter også de seneste fem minutters punkter, så mellemkommende spring kan vurderes; ved fejl bruges den seneste position sammen med gemt filtertilstand. Det tilføjer normalt én Traccar-forespørgsel pr. kontrolleret tracker.

Batterialarmer og alarm for manglende GPS-rapporter bevarer deres hidtidige grundlag. Geofencens eksisterende margen og krav om to friske positioner er uændrede og gælder efter GPS-filteret.

## Begrænsninger
Dette er et plausibilitetsfilter, ikke en forbedring af GPS-antennen. Den første position uden en tidligere troværdig reference må bruges som udgangspunkt, medmindre den rapporterer dårlig nøjagtighed. Små udsving, langsom drift og flere sammenhængende fejlpositioner kan stadig slippe igennem. Rigtig hurtig transport af en kat kan forsinke opdateringen. Filteret kan ikke bevise, at en position er korrekt. Traccars oprindelige historik ændres ikke. Tidligere arkiverede alarmer slettes ikke.

## Opdatering og kontrol
Upload den komplette pakke som tidligere. Tabellen pejlo_gps_filter oprettes automatisk i den eksisterende D1-binding; ingen nye nøgler eller manuelle databasekommandoer kræves. Trackerens firmware og indstillinger ændres ikke.

108 lokale automatiske tests bestået, inklusive vedvarende tilstand, API-position og rute, typeforskelle og baggrundsalarmer. Ikke testet med den fysiske Q8_H eller på live Cloudflare/iPhone. Efter upload: genåbn PWA, kontrollér en rigtig gåtur, historikken, alder ved usikkert signal og geofence ved en reel passage. Vælg korrekt profiltype.
