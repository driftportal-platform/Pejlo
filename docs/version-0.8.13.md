# Pejlo 0.8.13 – almindelig rulning

Den ekstra grønne rulleskyder er fjernet sammen med al dens pointer- og trækstyring. Den korte skyder omsatte tidligere små fingerbevægelser til store flytninger på lange sider. Telefonens normale rulning og rulleindikator bruges nu alene. Den frie kant til højre for kortet bevares, så man kan rulle uden at flytte selve kortet. »Til toppen« bevares og tager hensyn til reduceret animation.

Komplet pakke oven på 0.8.12; GPS-filter, baggrundsalarmer og alle tidligere funktioner er bevaret. Ingen nye Cloudflare-indstillinger eller databaseændringer i denne version.

108 lokale tests bestået. Rulleopdateringer kalder ikke længere scrollTo; kun et tryk på Til toppen gør det. Ingen ekstra slider eller pointer-håndtering oprettes. Ikke visuelt testet på fysisk iPhone. Efter upload: luk og genåbn PWA, kontrollér version 0.8.13, og rul ved at føre fingeren langs den frie kant til højre for kortet. Den grønne skyder skal være væk; den normale rulleindikator kan stadig vises. Prøv også Til toppen.
