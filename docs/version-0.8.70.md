# Pejlo 0.8.70 – tydelig trackerstatus

Upload ændrede filer oven på 0.8.69 med samme mapper via GitHub. Lad det normale Cloudflare-build udgive appen, og genåbn. Ingen serverkommandoer, secrets, bindings eller Firebase-indstillinger skal ændres.

Trackeroplysninger viser nu to adskilte linjer:

- Online / Offline / Forbindelse ukendt, med tidspunktet for seneste kontakt når det findes.
- Dvale: ukendt eller Dvale: rapport modtaget, afhængigt af de eksisterende målinger.

Sender rapporter er fjernet som hovedstatus. Frisk rapportering bekræfter ikke bevægelse, vågenhed eller dvale. Den gamle formulering Dvale senest bekræftet er erstattet med Seneste dvalerapport og ligger i et lukket felt, Om dvalestatus. Feltet forklarer kort forskellen mellem forbindelse og dvale. En historisk rapport præsenteres ikke som aktuel tilstand. Den aktuelle status flyttes ikke frem, blot fordi der kommer almindelige positioner.

Dvaleberegning, filtrering, trackerkommandoer og serveropsætning er uændrede. Ikonernes forklaringer bruger samme tydeligere historiktekst.

Kontrol: npm test, 332 beståede tests. Den nye regressionstest dækker historisk dvalerapport kombineret med frisk rapportering samt frisk dvalerapport og offline.
