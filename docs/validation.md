# Kontrol af 0.2

Bestået:
- Bygning til dist og syntakskontrol af JavaScript.
- Fem tests: afstand/format, verdensretninger og datolinje, kompasvinkel, zoom med GPS-usikkerhed og profilvalidering/lokal lagring.
- Browserkontrol: opret cykelprofil, skift navn og type til hund, genindlæs og vælg den oprindelige katteprofil.
- Browserkontrol: søgedemo viser 600 m og derefter 300 m med nordretning.
- Browserkontrol: valg af satellit uden nøgle giver en tydelig besked og bevarer eksempelkortet.
- Lokale modulreferencer i dist er verificeret.

Ikke afprøvet:
- MapTiler-kort med brugerens gyldige kortnøgle.
- GPS/kompas og responsivt layout på brugerens fysiske iPhone.
- Cloudflare-udgivelse fra brugerens GitHub-konto.
- Live-data, login, deling og rettigheder (ikke implementeret i denne version).
