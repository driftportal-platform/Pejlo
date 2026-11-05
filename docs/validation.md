# Kontrol af 0.3

Bestået:
- Bygning til dist og syntakskontrol af JavaScript.
- Ni tests, herunder: afstand/format, verdensretninger og datolinje, kompasvinkel, zoom med GPS-usikkerhed og profilvalidering/lokal lagring.
- Browserkontrol: opret cykelprofil, skift navn og type til hund, genindlæs og vælg den oprindelige katteprofil.
- Browserkontrol: søgedemo viser 600 m og derefter 300 m med nordretning.
- Browserkontrol: valg af satellit uden nøgle giver en tydelig besked og bevarer eksempelkortet.
- Lokale modulreferencer i dist er verificeret.

Ikke afprøvet:
- MapTiler-kort med brugerens gyldige kortnøgle.
- GPS/kompas og responsivt layout på brugerens fysiske iPhone.
- Cloudflare-udgivelse fra brugerens GitHub-konto.
- Live-data, login, deling og rettigheder (ikke implementeret i denne version).

0.3: Tom første start og migrering er testet. Urørt automatisk profil fjernes; egne profiler og kortnøgle bevares. Tom tilstand forbliver tom efter genindlæsning. Browserkontrol viser Pejlo-titel og oprettelse af egen cykelprofil fra velkomstsiden.
