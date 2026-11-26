# Pejlo 0.8.81 – kortmenu ved kortet

En Kortmenu-knap direkte på kortet åbner et panel. På mobil vises det fra bunden; på computer ligger det langs højre side. Her er Vis Loui, Hjemmeområde, Ture, Pause beskeder, Vis hele ruten, Bed om ny position, Sæt fast udgangspunkt, Følg trackeren og visningsvalgene for rute, hjemmeområde, afstandslinje og cirkler.

De oprindelige knapper og felter er flyttet ind i panelet. Deres tilstand, adgangsbegrænsninger og handlinger bevares. Menupanelet lukkes før en handling, der viser kortet, åbner områdeeditoren eller skifter side. Ved en positionsforespørgsel bliver panelet åbent, så resultatet kan læses. Escape, luk-knappen og tryk uden for panelet lukker det. Side- og profilskift lukker også panelet.

Hvileknappen og loggen bliver under kortet. Menuåbning sender ingen trackerkommandoer. Bed om ny position er fortsat en eksplicit handling.

Pakken indeholder også Wi-Fi-opdateringen fra 0.8.80 og kan lægges oven på 0.8.79 eller 0.8.80. Upload filerne med samme mapper som i ZIP-filen og brug det normale build.

Validering: automatisk test af menuens åbning, lukning, tilgængelighedsstatus og hvilke handlinger der holder panelet åbent. Den visuelle udformning og berøring skal fortsat kontrolleres på din mobil efter upload.
