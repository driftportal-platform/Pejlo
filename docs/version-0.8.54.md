# Pejlo 0.8.54 – find hjemmets Wi-Fi med trackeren

Bygger på GitHub-main 536b6a86d9f01a618e09ef866d9c5f27afcacddc (0.8.53).

## Installation

Upload ZIP-filens indhold til roden af det eksisterende Pejlo-repository. Mapperne apps, dist, docs og tests samt package.json og package-lock.json skal ligge på samme niveau som før. Pakken indeholder kun ændrede og nye filer. Cloudflare skal bruge sin sædvanlige kortnøgle ved build. Kontrollér version 0.8.54 i appen efter udgivelse. Denne pakke er ikke lagt på GitHub eller udgivet automatisk.

## Brug funktionen

1. Åbn Indstillinger → Profil → Hjemmets Wi-Fi med den rigtige tracker gemt på profilen.
2. Tryk Find hjemmets Wi-Fi. Lad trackeren være tændt, og flyt den til forskellige steder i huset. Appen samler nye målinger fra trackeren via den eksisterende forbindelse.
3. Vent på, at antallet af forskellige målinger stiger. Appen viser hver BSSID-adresse, seneste og stærkeste signal i dBm, antal målinger og alder. Samme måling tælles kun én gang, selv om appen henter den igen.
4. Stop søgningen. Sammenlign adresserne med din routers eller dit mesh-systems oversigt, og markér kun dine egne punkter. Stærkt signal beviser ikke, at et punkt er dit. Nye punkter er ikke valgt på forhånd.
5. Tryk Brug valgte Wi-Fi-punkter og derefter Gem profil. Eksisterende adresser bevares. Højst 16 adresser kan gemmes. Ændres adresserne, nulstilles den eksisterende inde/ude-indlæring som i 0.8.53.
6. Brug derefter Gem måling inde og Gem måling ude som før. Mindst tre forskellige målinger i hver gruppe kræves for en vejledende vurdering.

Wi-Fi-adressen kan stadig indtastes manuelt. Ingen Wi-Fi-adgangskode skal bruges. Ukendte, ikke valgte punkter opbevares kun i hukommelsen under søgningen; listen ryddes ved profilskift og logout. En ny søgning starter en ny liste. Søgningen fortsætter, mens appen er åben og kører; mobilens baggrundsbegrænsninger kan sætte den på pause.

## Hvad registreres?

Listen stammer fra trackerens egne scanninger, ikke fra telefonens Wi-Fi. Telefonens forbindelse til 5 GHz hindrer derfor ikke registrering af de 2,4 GHz-punkter, som trackeren ser. Appen ændrer ikke trackerens scanningsinterval og sender ingen nye kommandoer.

Det eksisterende datasæt indeholder BSSID og signalstyrke, ikke netværksnavn eller frekvens. Appen kan derfor hverken vise netværksnavnet, bekræfte frekvensen eller afgøre ejerskab. Kun de bånd, trackerens hardware og firmware faktisk understøtter, kan registreres. Mangler data fra Traccar, vises en ventebesked; appen opfinder ingen fund.

Kun online-målinger på højst to minutter accepteres, og ældre måletidspunkter genbruges ikke som nye scanninger. Der opsamles højst 64 forskellige kandidater per søgning. Kun eksplicit valgte punkter overføres til profilfeltet. Læsere kan ikke starte søgning eller ændre hjemmets Wi-Fi.

Funktionen ændrer ikke GPS, geofencealarmer eller trackerens batteriforbrug. Den automatiserer udvælgelsen af Wi-Fi-adresser til den eksisterende hjemmegenkendelse.

## Kontrol

- Build og syntakskontrol gennemført.
- 15 Wi-Fi-tests består, herunder 7 nye tests for opsamling på flere steder, afvisning af gamle og gentagne målinger, grænser, udvælgelse, læseadgang og profilskift.
- Den fulde testsuite blev forsøgt, men kan ikke gennemføres i dette miljø, fordi den eksisterende afhængighed @block65/webcrypto-web-push ikke er installeret og ikke kan hentes. Ingen afhængigheder er ændret.
- Visningen i en rigtig browser og registreringerne fra den fysiske Q8_H skal afprøves efter upload. En automatisk browsertest kunne ikke startes i dette miljø.

Kør npm ci og npm test i et miljø med netværksadgang, før udgivelse.
