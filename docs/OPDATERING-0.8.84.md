# Pejlo 0.8.84 – vælg selv stopafstand for hvile

Under Kort, ved hvileknappen, kan Automatisk stop af hvile åbnes. Vælg 10, 20, 30, 40 eller 50 meter og tryk Gem stopgrænse. Standard er 40 meter. Valget gemmes på serveren for den aktuelle profil, ejer og Traccar-server og genbruges ved nye hvileperioder. Ejere og redaktører kan ændre valget; læsebrugere kan kun se det.

Afstanden er forskydning mellem brugbare GPS-positioner, ikke summen af små GPS-hop eller samlet gået rute. Der kræves stadig flere forskellige målinger, gyldig GPS, mindst seks satellitter, bekræftet batteridrift og et sammenhængende forløb. Mindre grænser reagerer lettere på korte bevægelser, men også på GPS-udsving. Det er en GPS-vurdering, ikke målt søvn eller et direkte sensorsignal.

Afstandsvalget bruges i alle tre stopforløb: tre positioner med hastighed og forskydning; to positioner med hastighed og en efterfølgende bekræftet ankomst; eller fire positioner med sammenhængende forskydning. Forløbene bevarer deres tids- og kvalitetskrav. Valget garanterer derfor ikke stop ved præcis den valgte afstand.

Ændres grænsen under en aktiv hvileperiode, gælder den fra gemningen. Tidligere positioner genvurderes ikke efter den nye grænse. Selve periodens starttid ændres ikke. Grænsen vises under knappen og i loggen. Samtidige ændringer fra flere enheder kontrolleres med revisioner, og et igangværende bevægelsestjek må ikke gemme en afgørelse under en forældet grænse.

Den uploadede Pejlo-main(1).zip, version 0.8.83, er gennemgået. Dens ændringer til positionsopdatering, genoptagelse efter baggrundskørsel, opdatering af kortdata, alarmbehandling og versionsvisning er bevaret. Denne ændringspakke kan lægges oven på den uploadede 0.8.83 eller den tidligere 0.8.82.

Validering: funktionstest af alle fem afstande, afvisning af dårlige og gentagne målinger, adgangsrettigheder, konflikter, gemning af valg, ændring under en aktiv periode, historiske målinger og formularen. Ingen nye trackerkommandoer eller ændrede rapporteringsintervaller.
