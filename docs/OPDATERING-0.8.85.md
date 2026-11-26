# Pejlo 0.8.85 – hvilestop og kort under gang

To konkrete uoverensstemmelser er rettet:

- Aktivitet kunne vise I bevægelse efter to GPS-målinger, mens hvileknappen krævede et andet forløb. Den fælles vurdering af to gode målinger bruges nu også til hvilestop med profilens valgte stopafstand.
- GPS-filteret kunne holde markøren ved en gammel position efter flytninger over 95 meter. Ved fortsat gang kunne næste måling være mere end 75 meter fra den forrige, så filteret aldrig fik den forventede stationære bekræftelse. Målinger med tilstrækkelig kvalitet og hastighedsunderstøttet, plausibel flytning kan nu opdatere markøren under fortsat gang.

Kvalitet i det nye forløb kræver gyldig GPS, mindst seks satellitter, kendt batteridrift, acceptabel oplyst nøjagtighed, særskilte tidspunkter 20 sekunder til fem minutter fra hinanden og plausibel hastighed. Hvilestop kræver rapporteret bevægelseshastighed i begge ender og mindst profilens valgte afstand. Kortvisningen må begynde fra et stationært punkt, men kontrollerer også forholdet mellem forskydning og rapporteret hastighed. Gamle gemte filtertilstande uden kvalitetsfelter kan genfinde et troværdigt bevægelsesforløb fra nye målinger.

Manglende data, et enkelt dårligt GPS-hop, umulig hastighed eller målinger før hvileperiodens start stopper stadig ikke hvile. Har man valgt 50 meter, kan Aktiv godt vises efter en kortere flytning, mens hvileknappen fortsat afventer den valgte grænse. Data vurderes som GPS-estimater, ikke målt søvn.

Appen kan ikke vise en position, før trackeren har sendt den. Rapportering hver 120 sekunder kan derfor stadig give cirka to minutters ventetid. Denne rettelse ændrer ikke trackerens rapporteringsinterval eller sender ekstra kommandoer.

Pakken indeholder også afstandsvalget fra 0.8.84 og ændringerne i den uploadede 0.8.83. Upload oven på 0.8.83 eller 0.8.84. Standardstopgrænsen er fortsat 40 meter, og valget findes under Automatisk stop af hvile.

Valideringen omfatter et vedvarende forløb med 200 meter mellem GPS-rapporter gennem både filteret og tracker-API'et, gammel gemt filtertilstand, samme bevægelsesvurdering i status og hvile, alle fem stopafstande og fortsat afvisning af utilstrækkelige målinger. Den fysiske tracker og installerede app skal fortsat efterprøves efter upload.
