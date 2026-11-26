# Pejlo 0.8.76 – automatisk stop af registreret hvile

Upload ændringspakken oven på 0.8.75 via GitHub med samme mapper. Lad det normale Cloudflare-build udgive appen, og genåbn Pejlo. Statusfeltet, statusikonerne og statuslinjen er uændrede. Ingen serverkommandoer, secrets eller Firebase-ændringer. To kontrolfelter i D1 oprettes automatisk på den eksisterende hviletabel.

Den tidligere version krævede mindst 2 km/t i hver af tre målinger og kasserede alt mere end fem minutter gammelt. En kat kan flytte sig mellem målinger, som hver rapporterer 0 km/t, og bevægelsen kunne være for gammel, når kontrollen læste den. Det er begrænsninger i algoritmen; den konkrete morgens årsag kan først bekræftes med målingerne fra perioden.

Automatisk stop kan nu understøttes af:

- Tre gode GPS-punkter med rapporteret hastighed og sammenhængende forskydning, som før.
- Fire gode GPS-punkter, som bekræfter mindst 60 meters sammenhængende flytning. Denne vej kræver ikke mindst 2 km/t i hvert enkelt punkt. Mindst to delstræk skal være over 10 meter, og ét spring må ikke dominere flytningen.

Begge veje kræver gyldige positioner, mindst seks satellitter, ingen opladning og højst 25 meters rapporteret usikkerhed når den findes. Urealistiske spring, modstridende kopier, GPS-hop ud og tilbage og for store huller afbryder vurderingen. Der tillades op til fem minutter mellem punkterne. Fire-punktsforløbet skal ligge inden for 15 minutter.

Kontrollen kan også gennemgå gemte positioner efter den manuelle start. Ved bekræftet bevægelse afsluttes en stadig aktiv hvileperiode ved den første måling i det bekræftede bevægelsesforløb – ikke tidspunktet hvor appen åbnes. Allerede manuelt afsluttede perioder omskrives ikke. Dagens samlede hvile beregnes herefter med det korrigerede sluttidspunkt; en manuelt indtastet dagstotal har fortsat forrang.

Appens almindelige historikopslag bruges til kontrollen. Med lukket app kan den eksisterende serverkontrol også hente gemt historik, højst én gang pr. fem minutter pr. aktiv periode, i afgrænsede intervaller på højst ét døgn. En komplet historikrespons flytter kontrollens markør frem. Fejl og afkortede svar tæller ikke som en fuldført kontrol. Kun den rigtige tracker, ejer, profil og datakilde behandles.

Der sendes ingen ekstra positionsforespørgsler, opvågningskommandoer eller intervalændringer til trackeren. Historikopslagene læser data, som Traccar allerede har modtaget. Uden tilstrækkelige pålidelige målinger må perioden stadig stoppes manuelt; der antages ikke bevægelse alene ud fra Online-status.

Validering: 362 tests bestået, 0 fejl. Nye regressioner dækker fire positioner med rapporteret 0 km/t, historik genlæst efter tre timer, offline-historik, isolerede GPS-hop med efterfølgende drift og Louis tidligere positionsudsving.
