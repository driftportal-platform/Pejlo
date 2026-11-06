# Pejlo 0.8.9

- »Sæt fast udgangspunkt« er flyttet til sin egen række under kortet og kan derfor ikke dække zoomknapperne eller kortets kildeangivelse.
- Kortet fylder nu 62 % af vinduets højde på mobilen. Oplysningerne og genvejene følger længere nede på siden. Den faste bundmenu og rulleskyderen bevares.
- Et fast, uigennemsigtigt felt dækker telefonens sikre topområde. Indholdet starter under feltet, så det ikke ligger bag ur og signal ved rulning i PWA'en. I almindelig browser vises feltet kun, hvis browseren udleverer et sikkert topområde.
- Områdeeditorens højde tager også højde for telefonens sikre topområde.

Upload projektfilerne til GitHub som før. Ingen nye Cloudflare-indstillinger eller databaseændringer.

Validering: build og 97 automatiske tests bestået. Backend er uændret. Der er ikke udført visuel test på fysisk iPhone. Efter upload bør PWA'en lukkes og genåbnes; kontrollér +/−, valg af udgangspunkt, topfelt under rulning samt stående og liggende visning.
