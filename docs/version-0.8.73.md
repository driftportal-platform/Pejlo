# Pejlo 0.8.73 – animeret opladning

Upload ændringspakken oven på 0.8.72 via GitHub med samme mapper. Lad det normale Cloudflare-build udgive appen, og genåbn Pejlo. Ingen ændringer på Traccar-serveren eller i Firebase.

Det eksisterende batteriikon i profilfeltet viser grønne streger, som fyldes under opladning. Lynet bevares som den separate opladningsindikator. Animation kræver en online tracker og en opladningsrapport højst fem minutter gammel. Den stopper ved ophørt opladning, gamle data, offline eller profilskift. Ved rapporteret 100 % vises et fuldt batteri uden animation. Animationen viser opladning, ikke en målt procentstigning; tryk på ikonet for det rapporterede batteriniveau og forklaring.

Ikonernes SVG-elementer genbruges ved appens løbende aldersopdatering, så animationen ikke begynder forfra hvert sekund. Det bevarer også tastaturfokus. Ved systemindstillingen for reduceret bevægelse står stregerne stille.

Ændringen er kun visuel. Der sendes ingen nye trackerkommandoer og foretages ingen ekstra dataopslag.

Validering: 348 tests bestået, 0 fejl, herunder frisk/gammel opladningsstatus, 100 %, offline, profilskift og genbrug af SVG under aldersopdatering.
