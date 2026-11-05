# Fælles kortopsætning · 0.4.1

MAPTILER_API_KEY læses kun af scripts/build.mjs og skrives som offentlig browserkonfiguration i dist/src/config/maps.js. Kildekonfigurationen indeholder ingen kundes nøgle. Cloudflare skal bygge på ny ved ændring af variablen.

Brugerprofilernes gamle mapKey-felt normaliseres til tom streng af kompatibilitetshensyn med publicerede Firestore-regler. Det bruges aldrig ved kortkald. Felt og formular er fjernet fra brugerfladen. Gadekort vælges automatisk fra fælles konfiguration. Et mislykket kortskift beholder tidligere lag og viser en besked; dropdown afspejler kun det lag, der faktisk er indlæst. Søgekort bruger samme fælles nøgle og valgte lag.

Der er ikke indsat en rigtig MapTiler-nøgle i denne pakke. Live kortkald med ejerens nøgle skal afprøves efter buildvariablen er sat og appen genudgivet.
