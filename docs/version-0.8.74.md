# Pejlo 0.8.74 – start og stop registreret hvile

Upload ændringspakken oven på 0.8.73 via GitHub med samme mapper. Lad det normale Cloudflare-build udgive appen, og genåbn Pejlo. Ingen nye secrets, bindings, Firebase-indstillinger eller installation på Traccar-serveren. De nye D1-tabeller oprettes automatisk. Automatisk kontrol med lukket app bruger den eksisterende planlagte Worker-kørsel.

På kortforsiden har dyreprofiler med en tracker nu en **Start hvile**-knap. Trackeren skal være gemt som påsat under Indstillinger. Når du trykker, gemmer serveren starttidspunktet, og knappen bliver **Stop hvile**. Et nyt tryk gemmer sluttidspunkt og varighed. Perioden fortsætter, selv om du genåbner appen eller logger ind fra en anden enhed. Profilens ejer og redaktører kan starte og stoppe; læsebrugere kan se status og log. Genstande viser ikke hvileknappen.

Tiden indgår i dagens samlede hvile, oversigten og grafen under Ture. Det er **registreret hvile**, ikke målt søvn. Overlap med GPS-estimeret hvile og dvalerapporter tælles kun én gang. En manuelt rettet dagstotal, også 0, har fortsat forrang. Perioder over midnat fordeles på de danske datoer. Knappen virker også, når automatiske hvileestimater er slået fra.

Loggen på kortforsiden ligger i et sammenklappeligt felt med de seneste 20 perioder: start, stop, varighed og stopårsag. Data gemmes hos profilens ejer, så delte brugere ser samme periode. Højst én periode kan være aktiv pr. tracker/profil/server. Gentagne eller forsinkede klik kan ikke oprette dubletter eller stoppe en nyere periode.

## Automatisk stop

Der kræves tre nye, brugbare GPS-positioner efter start: mindst seks satellitter, højst 25 meters rapporteret usikkerhed når den findes, mindst 2 km/t i hver måling, mindst 10 meter mellem punkterne og mindst 35 meters samlet forskydning. Målingerne skal være højst fem minutter gamle, højst 2½ minut fra hinanden og spænde over mindst 20 sekunder. Urealistiske hastigheder, modstridende kopier og et GPS-hop ud og tilbage kan ikke bekræfte bevægelse.

Ved bekræftet bevægelse stoppes perioden ved tidspunktet for den første af de tre målinger, og årsagen gemmes. Der kan derfor gå omkring 4–6 minutter ved et rapporteringsinterval på to minutter, før automatisk stop vises. Mere spredte eller usikre målinger kan betyde, at automatisk stop ikke kan ske.

Opladning eller en registreret fjernelse af trackeren afslutter også perioden med en særskilt årsag. Der startes ikke automatisk en ny hvileperiode bagefter.

Manglende eller usikker GPS stopper ikke knappen og beviser ikke fortsat hvile. Appen viser, at automatisk stop afventer friske målinger. Tiden er stadig din manuelle registrering og kan korrigeres som dagstotal under Ture.

Bevægelseskontrollen læser allerede modtagne positioner i Traccar, både ved appens opdateringer og serverens planlagte kørsel. Den sender ingen nye positionsforespørgsler eller intervalkommandoer til trackeren. Hvis serverkontrollen ikke kører eller ikke kan læse data, afventes kontrol; der opfindes ikke en bevægelseshændelse.

Validering: 358 tests bestået, 0 fejl. Dækker adgang, samtidige/gentagne tryk, forsinkede svar ved profilskift, troværdig bevægelse kontra GPS-hop, gamle målinger, opladning, fjernelse, baggrundskontrol uden trackerkommandoer, døgnskifte, samlede hviletal, overlap, manuelle rettelser og sletning af kontodata.
