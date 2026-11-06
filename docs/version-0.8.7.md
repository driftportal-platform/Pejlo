# Pejlo 0.8.7 – kort og områdeeditor

Komplet pakke baseret på 0.8.6, inklusive den ændrede Firebase-initialisering. Server, database og roller er bevaret.

På telefonen er Kort hovedvisningen med et større kort og et kompakt informationskort nederst. “Flere oplysninger” folder afstand og kontaktoplysninger ud. GPS-alder, batteri og hjemmestatus er synlige i den kompakte visning. Genveje åbner Loui-positionen, områdeeditor, Ture eller egne beskeder. Kortvalg og de valgfrie rute-/afstandslag er bevaret. Detaljekortet foldes med en knap; det har ikke trækgestus i denne version.

“Hjemmeområde” åbner en særskilt editor med kort, navn og valg mellem cirkel og polygon. Tryk på kortet for cirklens centrum og justér radius med skyderen (20–5000 m). Ved polygon trykkes langs grænsen; sidste punkt kan fortrydes, og mindst tre punkter kræves. Den eksisterende ekstra margen bevares. Ændringer er kladder, indtil Gem bruges; lukning annullerer kladden. Læsere kan ikke åbne editoren. Den eksisterende områdeformular med gemte områder og sletning findes stadig under Indstillinger → Område.

Vælg et geografisk kortlag før et rigtigt område gemmes. Ingen hardwarekommandoer tilføjes. Alle tidligere funktioner, foto, arkiv, deling, push og mail følger med.

Upload indholdet til GitHub som hidtil. Ingen nye nøgler eller databasetrin kræves. Genåbn PWA'en og kontrollér version 0.8.7. Afprøv kortlayout og områdeeditor på telefonen, herunder cirkel, polygon, annullering, gemning og delt bruger med læseadgang.

95 lokale tests inklusive build består. De nye editor-tests dækker kladde/annullering, radius, gemning, minimumspunkter og læseadgang med en simuleret DOM. Der er ikke gennemført fuld visuel mobilbrowserkontrol eller live kort-/Firebase-test. Udseende og kortbetjening skal afprøves på telefonen efter upload.
