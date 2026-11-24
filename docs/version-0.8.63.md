# Pejlo 0.8.63 - centrering ved mobil-/Wi-Fi-placering

Upload ændringspakken oven på 0.8.62 med samme mapper, og lad det normale Cloudflare-build udgive appen. Genåbn PWA bagefter. Ingen ændringer i Firebase, Cloudflare-indstillinger, DB-binding eller secrets kræves. Pakken er ikke automatisk udgivet.

Centrér-knappen og automatisk centrering brugte Circle.getBounds() på en Leaflet-cirkel, som endnu ikke var tilføjet til kortet. Denne metode kræver et tilknyttet kort og kunne derfor stoppe centreringen med en fejl. Rettelsen bruger LatLng.toBounds() direkte fra koordinat og usikkerhedens diameter og behøver ikke oprette en ekstra cirkel.

Små usikkerhedsområder, fx cirka 33 meter, kan nu vises op til zoom 18. Store områder tilpasses stadig via fitBounds, så usikkerheden ikke skjules. Usikkerhedscirklen og betegnelsen omtrentlig placering bevares. Centrering på GPS bruger fortsat zoom 18; almindelig følgning panorerer uden at nulstille det valgte zoom.

Build og alle 301 tests er bestået. Korttesten modellerer nu også Leaflets krav om et tilknyttet kort for Circle.getBounds(). Den kontrollerer centrering med 33 og 1.200 meters usikkerhed samt fortsat GPS-centrering og følgning. Fysisk test i PWA: træk kortet væk, tryk på sigtekornet og kontrollér at den viste trackerposition kommer frem; gentag ved mobil-/Wi-Fi-estimat.
