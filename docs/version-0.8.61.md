# Pejlo 0.8.61 - automatisk GPS-oversigt

Upload ændringspakken oven på 0.8.60 med de samme mapper. Lad det normale Cloudflare-build køre, og behold MAPTILER_API_KEY under Builds. Ingen nye secrets, trackerkommandoer eller databaseændringer kræves. Pakken er ikke automatisk udgivet.

Motionshistorikken henter nu GPS-estimater automatisk, når profilen har en tracker. Manuelle felter kan bruges, mens GPS hentes. Knappen Opdatér GPS-oversigt giver mulighed for at prøve igen. Tom historik, punkter uden brugbare sammenhængende intervaller og hentefejl har forskellige beskeder. En gammel forespørgsel kan ikke overskrive en ny profil eller en ny periode. Omdøbning af profilen opdaterer overskriften uden at rydde historikken. Datoerne vises på dansk uden linjeskift, og tabellens overskrifter følger med under rulning.

Hvile registreres fortsat manuelt. GPS-ro er ikke målt søvn, og datamangler bliver ikke til inaktivitet. Advarsler om ændret adfærd og beregning af et personligt normalniveau er endnu ikke implementeret i denne udgave.

Validering: build og 274 automatiske tests bestået, herunder automatisk GPS-hentning, profilnavn, tomme data, hentefejl og sene svar efter profil- og periodeskift. Fysisk kontrol i PWA og med Traccar er stadig nødvendig.
