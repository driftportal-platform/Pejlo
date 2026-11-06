# Pejlo 0.8.11 – rulleskyder

Skyderen bevarer det sted, fingeren griber, så siden ikke hopper ved første berøring. Hurtige fingerbevægelser samles til én rulning pr. animationsbillede. Skyderens størrelse og sidens rullelængde fastholdes under hvert træk, og markøren flyttes med en grafisk transformation. Det mindsker gentagne layoutberegninger. Tastatur, Til toppen og skjulning ved dialoger/login bevares.

Komplet pakke oven på 0.8.10. Ingen ændringer af backend, database eller Cloudflare-indstillinger.

Validering: 99 automatiske tests bestået, herunder greb uden hop, sammenlægning af hurtige bevægelser og stabil geometri under træk. Ikke afprøvet på en fysisk iPhone; den oplevede flydende bevægelse skal bekræftes dér.

Efter upload og genåbning af PWA: grib skyderen øverst og nederst på håndtaget, træk langsomt og hurtigt begge veje, og prøv også normal rulning ved siden af kortet.
