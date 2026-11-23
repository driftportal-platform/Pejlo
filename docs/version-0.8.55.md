# Pejlo 0.8.55

Bygger på GitHub main b0cdab3de2672f93f0263626288ec547cab66c05 (0.8.54).

## Ændringer

Hjemmets seneste registrerede Wi-Fi-signaler bevares på serveren med deres oprindelige måletidspunkt. En senere rapport uden Wi-Fi sletter ikke historikken. Efter genåbning af appen kan målingen derfor stadig vises. Historikken begynder ved første Wi-Fi-måling modtaget efter installation; tidligere tabte målinger kan ikke genskabes af denne ændring.

Visningen bruger kun den aktuelle profils valgte adresser. Historiske værdier vises som Sidst målt med alder, uden aktive signalbjælker. De historiske værdier bruges ikke som nye målinger til inde/ude-indlæring eller aktuel hjemmevurdering. GPS og alarmer ændres ikke. Gemte adresser og den midlertidige Wi-Fi-søgeliste har fortsat hver deres funktion.

Serverstatus vises under kontooplysningerne, særskilt fra profilsynkronisering og trackerens online/offline-status. Appen kontrollerer den autentificerede Pejlo-API og dens adgang til Traccars /api/server. Kontrollen sker ved login, cirka hvert 30. sekund mens appen er synlig, og igen når appen bliver synlig. Kontrollerer server, Server online og Server kan ikke kontaktes er de tre statusbeskeder. En forbindelsesfejl kan også skyldes telefonens internet, udløbet login eller serveropsætning; beskeden er ikke et bevis for, at servermaskinen er slukket. Ingen credentials eller serveroplysninger udleveres af sundhedstjekket. Ingen kontrol foretages i baggrunden, når appen er lukket.

## Installation

Upload ZIP-filens indhold til repositoryets rod og lad det sædvanlige Cloudflare-build og deploy køre. Både apps/api-filerne og webændringerne skal udgives. Ingen database-migration kræves; seneste Wi-Fi gemmes i det eksisterende trackerfilter med samme adgangskontrol og adskillelse mellem serverkilder. Bevar den eksisterende MAPTILER_API_KEY i buildmiljøet. Pakken indeholder kun ændrede eller nye filer. GitHub og den kørende app er ikke ændret automatisk.

## Kontrol

25 målrettede tests består: serverlagring af seneste Wi-Fi, oprindelige tidspunkter, profiludvælgelse, historiske data uden aktuel hjemmevurdering, sundhedstjek, logout, sidesynlighed, eksisterende Wi-Fi-indlæring og PWA-filer. Build og syntakskontrol er gennemført. Fuld API-testsuite kræver installation af den eksisterende @block65/webcrypto-web-push-afhængighed, som ikke var tilgængelig lokalt. Mobilvisning og serverstatus ved et reelt serverudfald er ikke afprøvet i browseren. Kør npm ci og npm test i det normale buildmiljø.
