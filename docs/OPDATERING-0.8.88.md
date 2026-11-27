# Pejlo 0.8.88 – automatik og tidsbegrænset Find

Find kan vælges i 5, 10, 15 eller 30 minutter med et ønsket rapporteringsinterval på 30 sekunder. Der vises en løbende nedtælling. Stopknappen afslutter perioden før tid. Ved udløb står der, om tilbagevendingen fortsat afventer serveren eller forbindelse. Ny Find er blokeret i brugerfladen under en aktiv periode og ventende tilbagevending.

Status læses automatisk hvert 15. sekund, mens feltet er synligt. Disse opslag sender ikke kommandoer til trackeren. Ugemte ændringer af automatik bliver stående under opdateringen. Profilskift kasserer gamle svar. Der er ingen opslag, mens fanen eller feltet er skjult.

Automatik bruger 120 sekunder efter tre tydelige, friske Wi-Fi-hjemmemønstre over mindst to minutter. Ude, usikre eller gamle målinger giver 60 sekunder. Aktivering kræver tre gemte målinger inde og tre ude. Batterigevinsten er ikke målt; Wi-Fi-mønstre beviser ikke, at dyret er indendørs.

Serveren gendanner det tidligere manuelle interval eller genoptager automatik efter Find, også når browseren er lukket. En genstart af Find efter udløb bevarer nu det oprindelige returinterval frem for at gemme Find-intervallet 30 sekunder. Gemning af automatik under Find afbryder ikke længere Find-perioden. Offline tilbagevending bliver stående indtil forbindelse; uafklarede afsendelser gentages ikke blindt.

Status skelner mellem afsendelse til Traccar og en bekræftelse fra trackeren. Der er stadig ikke implementeret aflæsning af trackerens intervalparameter. Find garanterer derfor ikke GPS-opvågning eller nye positioner hvert 30. sekund. Serverens minutkontrol kan forsinke tilbagevending cirka ét minut, længere ved offline/uafklaret afsendelse.

Upload oven på 0.8.87. Den eksisterende serveropsætning med minutplanlægning og PEJLO_BATTERY_DEVICES skal bevares. Der er ikke aktiveret automatik eller sendt fysiske trackerkommandoer under udviklingen. Find og manuel hvile er separate funktioner.
