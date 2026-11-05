# Pejlo · 0.4.0

Dansk trackerprototype med personligt Firebase-login og privat profillagring.
Start i **START_HER.md**. Firebase skal konfigureres før første brug.

- E-mail/adgangskode, bekræftelsesmail og nulstilling af adgangskode.
- Tom konto ved første start. Brugeren vælger selv navn og type.
- Flere profiler med egne ikoner og hjemmeområder, synkroniseret pr. konto.
- Kortlag via MapTiler; lokal skematisk kortdemo uden kortnøgle.
- Afstand og retning fra mobilen til et tydeligt mærket eksempelpunkt.

Fysiske trackere, familiedeling og medlemsroller er endnu ikke tilsluttet.
Alle målpositioner, ruter og batterital er fortsat eksempeldata.

Node.js 20+: `npm test` bygger og kører 14 tests. `npm run build` bygger dist.
Kilder ligger i apps/web og packages/shared. Dist genereres automatisk.
Firebase SDK 13.2.0 indlæses som browsermoduler fra Googles CDN.
