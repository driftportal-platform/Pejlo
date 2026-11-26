# Pejlo 0.8.82 – mere plads til kortet

Kortvisningen har nu kun to små knapper på selve kortet: centrér og kortmenu. Kortlaget ligger i kortmenuen. Den tidligere række med Kort, Hjemmeområde og Oplysninger skjules i selve kortvisningen; de ekstra visninger er tilgængelige fra Kortmenuen. På de andre kortvisninger er fanerne stadig synlige, så man kan vende tilbage til Kort.

Loui-profilen er lidt mere kompakt på mobil. Dens status og seks signalikoner er bevaret. Højden af mobilkortet beregnes ud fra kortets placering, skærmens højde og den faste bundmenu. Kortet afsluttes med lidt luft over bundmenuen, når der er plads. På meget lave skærme bevares mindst 160 pixels til kortet og almindelig rulning. Beregningen ændrer ikke højden ved almindelig rulning og undgår at tilpasse baggrunden, mens man skriver eller zoomer browseren.

Kortets resize bevarer kortets centrum; den slår ikke manuel panorering fra. Ved en manglende position kan appen fortsat ikke garantere, at dyret kan vises.

Pakken lægges oven på 0.8.81. Ingen trackerkommandoer, målegrænser eller Wi-Fi-indstillinger er ændret.

Validering: 375 automatiske tests bestået. En lokal prøvevisning med mobile bredder er undersøgt med eksempeldata; geometri viste kortets bund 10 pixels over navigationen. Den installerede iPhone-app med rigtige trackermålinger skal fortsat kontrolleres efter upload.
