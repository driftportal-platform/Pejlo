# Pejlo 0.8.89 – mobilmenu ved skærmens bund

Bundmenuens placering følger nu VisualViewport, den synlige del af mobilskærmen, i stedet for alene CSS bottom:0. Der genberegnes ved rulning, ændret vindueshøjde, rotation, retur til appen og efter lukning af et inputfelt. Menuen har en selvstændig renderingsflade og en dækkende baggrund. Højden måles inklusive sikkerhedsafstand, og der reserveres plads nederst i dokumentet, så sidste indhold kan rulles fri af menuen.

Normal rulning flytter ikke menuen med dokumentet. Ved åben skærmtastatur ligger menuen ved bunden af det synlige område. Zoom forbliver tilgængelig; ved pinch-zoom bruges browserens normale fixed-positionering. Desktop-sidebaren beholder sit layout.

Test omfatter synlig skærmhøjde, tastaturforskydning og tilbagevending, rulning, desktop-skift og oprydning af lyttere. En lokal mobilvisning er kontrolleret. Den konkrete fejl på en fysisk iPhone/Safari skal stadig efterprøves efter upload; der er ikke kørt en fysisk iPhone-test.

Pakken indeholder også 0.8.88 med automatik og tidsbegrænset Find. Upload oven på 0.8.87 eller 0.8.88. Ingen trackerkommandoer er sendt under udviklingen.
