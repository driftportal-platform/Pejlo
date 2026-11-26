# Pejlo 0.8.78

Automatisk stop af manuel hvile genkender nu også en gåtur, hvor trackeren står stille ved den sidste måling. Den eksisterende regel krævede enten tre målinger med hastighed og forskydning eller fire målinger med et større sammenhængende forløb. Det overså aftentestens to målinger med hastighed og en efterfølgende bekræftelse med 0 km/t.

Den ekstra regel kræver tre forskellige brugbare GPS-målinger: De første to skal vise mindst 2 km/t, ligge mindst ét minut fra hinanden og være mindst 40 meter fra hinanden. Den sidste skal ligge 5–120 sekunder efter den anden, vise højst 1 km/t og bekræfte ankomsten inden for 15 meter. Slutpositionen skal stadig være mindst 40 meter fra første position. Alle målinger skal være gyldige, have mindst seks satellitter og bekræftet batteridrift. Dårlig oplyst nøjagtighed, tidsfejl, datamangler og usandsynlig hastighed afvises fortsat.

Dette er GPS-baseret bevægelse, ikke målt søvn eller et direkte signal fra bevægelsessensoren. Et enkelt udsving, en gentaget pakke eller et hop tilbage kan ikke udløse den nye regel.

Regressionstesten bruger position, tid, hastighed og satellitantal fra de faktiske aftenpakker 26. november. Den stopper hvile ved 22.04.02 med bekræftelse kl. 22.06.11, dansk tid. Samme forløb testes gennem serverens lagring, så perioden afsluttes med årsagen bevægelse. Dette beviser kodeadfærden; den installerede server og app skal fortsat bekræftes efter upload.

Pakken indeholder også menupunkterne fra 0.8.77 og kan uploades oven på 0.8.76 eller 0.8.77. Ingen miljøvariabler eller trackerindstillinger ændres. Gemte positioner læses; der tilføjes ingen kommandoer til trackeren. En stadig åben hvileperiode kan afsluttes ud fra den gemte historik, hvis den findes i Traccar. Allerede manuelt afsluttede perioder ændres ikke.
