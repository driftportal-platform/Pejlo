# Pejlo 0.8.71 – bevægelse og mulig hvile

Upload filerne i denne ændringspakke oven på 0.8.70 med samme mapper via GitHub. Det normale Cloudflare-build udgiver appen. Genåbn Pejlo efter udgivelsen. Der er ingen nye secrets, bindings eller Firebase-indstillinger og ingen ændringer til programmet på Traccar-serveren.

Under Indstillinger skal dyrets profil være gemt med trackeren markeret som påsat. Bekræftelsen gælder fra det registrerede tidspunkt; vi opfinder ikke en historisk påsat-periode. Hvilehistorikken bruger serverens allerede gemte bekræftelser af påsat/taget af. Ved manglende bekræftelse: gem profilens påsat-status og afvent nye målinger. Funktionen gælder dyreprofiler, og navnet følger den valgte profil.

Trackeroplysninger og profilens ikoner viser:

- **Mulig hvile:** mindst 15 minutters lav GPS-hastighed (højst 1 km/t), positioner inden for et område på højst 25 meter og højst fem minutter mellem målingerne. Der kræves kendt fravær af opladning. En frisk dvalerapport kan også støtte vurderingen, når påsat-status og en nylig måling uden opladning findes.
- **I bevægelse:** to brugbare målinger med mindst 2 km/t og mindst 10 meters forskydning, uden et urealistisk spring. Rapportering alene giver ikke bevægelsesstatus.
- **Aktivitet: ukendt:** utilstrækkelige eller gamle data, offline, usikker GPS, opladning eller manglende påsat-bekræftelse.

Månen betyder nu mulig hvile, pulsen betyder GPS-vurderet bevægelse. Tryk på ikonerne for forklaringen. En grå puls beviser ikke hvile. Kontakt/online vises stadig særskilt. Den gamle dvalerapport ligger under Om aktivitet og dvale og vises ikke som aktuel aktivitet.

Under Ture indgår sammenhængende GPS-ro i det anslåede hviletal og grafen, når GPS-oversigten hentes. GPS-intervaller og dvalerapporter forenes uden dobbelt optælling. Manuelle dagstotaler, også 0, erstatter estimatet. Datamangler og opladning tælles ikke som hvile. Der tælles kun mellem faktiske målinger, aldrig frem til nu fra sidste kendte måling. Tidspunkter følger Traccars afkodede GPS-tid, så gamle uploads ikke bliver aktuelle. Tidligere afviste fremtidspunkter kan ikke genskabes af denne opdatering.

Dette er et estimat af mulig hvile og GPS-vurderet bevægelse – ikke målt søvn eller en bekræftet aflæsning af bevægelsessensoren. GPS kan overse små bevægelser. Funktionen sender ingen nye kommandoer til trackeren og kræver ingen ekstra løbende historikopslag. GPS-dagstal genbruges fra cache; påsat-historik og indstillingen for automatisk hvile anvendes ved hvert opslag.

Validering: regression med Louis ti faktiske koordinater fra 25.11 kl. 08.30–08.48, datamangler, opladning, usikker GPS, tidsfejl, bevægelse, påsat/taget af, midnat, cache, overlap, manuelle rettelser og historikvisningen. Den fulde testpakke består: 343 tests, 0 fejl.
