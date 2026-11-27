# Pejlo 0.8.87

Opladning afslutter ikke længere en manuelt startet hvileperiode. Under opladning forklarer knappen, at perioden fortsætter som ejerens manuelle registrering. GPS under opladning tæller ikke som bevægelse. Bevægelseskontrollen begynder med nye målinger efter seneste opladningsrapport og forbinder ikke punkter på tværs af opladningen. Manuelt stop og eksplicit markering som taget af er fortsat mulige. Start af en ny periode under opladning er fortsat blokeret.

Batterivisningen er ikke ændret uden en rå rapport fra opladningen. Koden omsætter ikke opladning til 100 procent; den bruger batteriniveauet fra Traccar. Et spring fra 72 til 100 procent ligger inden for det eksisterende filters tolerance på 35 procentpoint og slipper derfor igennem. Serverloggen skal vise, om trackeren selv sender 100 procent, før der vælges en rettelse.

Upload oven på 0.8.86.
