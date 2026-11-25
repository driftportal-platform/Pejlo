# Pejlo 0.8.69 – forklaring på statusikoner

Upload ændringspakken oven på 0.8.68 i GitHub med de samme mapper. Lad det normale Cloudflare-build udgive appen, og genåbn den. Ingen nye Firebase-indstillinger, secrets eller serverkommandoer kræves.

Tryk på månen, pulsen, satellitten, mobilstregerne, Wi-Fi, batteriet eller lynet i det valgte profilfelt. En lille dialog viser profilnavn, ikonets navn, den aktuelle måling og en forklaring på betydningen og farverne. Luk med krydset, Escape eller ved tryk udenfor. Målingen opdateres med appens eksisterende data. Ved profilskift lukkes forklaringen, så den ikke viser data fra den forrige profil.

Navnet og pilen åbner fortsat profilvalget. Statusikonerne er separate knapper med tastaturbetjening og oplæsningsetiketter.

Forklaringerne gør særligt klart, at aktiv rapportering ikke beviser bevægelse eller vågenhed, dvalerapporter ikke måler søvn, og en grå måne betyder ukendt dvale. Rødt lyn betyder blot, at trackeren ikke oplader. Grå signaler er ukendte eller for gamle, ikke automatisk dårlige. Wi-Fi alene beviser ikke inde/ude.

Validering: npm test, 331 beståede Node-tests inklusive Python-statuslæserens tests. Den nye interaktionstest kontrollerer ikontryk, åbning, tekst, opdatering, lukning og profilskift. Ingen ændringer af protokol, kommandoer eller trackerindstillinger.
