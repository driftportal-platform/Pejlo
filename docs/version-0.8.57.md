# Pejlo 0.8.57 – batteriautomatik og tidsbegrænset Find

Bygger på 0.8.56. Ændringspakken indeholder kun nye og ændrede filer med deres eksisterende mapper. Den er ikke udgivet automatisk.

## Det nye

- Automatisk intervalskift: 120 sekunder ved tre forskellige, friske og tydelige hjemmemønstre over mindst to minutter; ellers 60 sekunder. Kræver mindst tre gemte inde- og tre udemålinger under Profil samt ejerens bekræftelse. Wi-Fi giver en vejledende vurdering, ikke bevis for indendørs ophold.
- Find i batteriafsnittet: 30 sekunder i 5 eller 15 minutter, derefter tilbage til automatik eller tidligere manuelt interval. Afslut Find nu stopper perioden tidligere. Dette er særskilt fra den eksisterende Find-visning.
- Serveren kontrollerer cirka hvert minut med lukket app. Offline udsætter tilbagevendingen, og kommandoer lægges ikke i kø. Minimum ét minut mellem intervalkommandoer. På en større installation afhænger forsinkelsen også af antallet af aktive politikker; op til otte behandles pr. minut.
- Et manuelt intervalønske afbryder automatik og Find, når afsendelse forsøges. Offline-/validerings-/minutbegrænsningsafvisninger bevarer en eksisterende Find-sluttid. Uafklarede afsendelser gentages ikke blindt. Ved Find-udløb kan tilbagevending forsøges én gang, selv om det første Find-ønske var uafklaret.
- Automatiske og manuelle intervalønsker bruger samme afsendelseslog og vises i batterihistorikken. Afsendt til Traccar er fortsat ikke kvittering fra trackeren eller aflæsning af aktivt interval.

Ingen indstillinger aktiveres ved upload, login eller åbning af batterisiden. Automatik skal vælges og gemmes af ejeren. GPS-dvale er ikke aktiveret: korrekt dvalekommando og sikker opvågning er endnu ikke fysisk afprøvet på denne firmware. Find garanterer heller ikke opvågning eller et nyt GPS-fix.

## Upload

1. Udpak og upload filerne til roden af driftportal-platform/Pejlo med samme mapper. Pakken forudsætter den eksisterende 0.8.56-installation.
2. Bevar eksisterende Cloudflare Worker, D1-binding DB, secrets, MAPTILER_API_KEY i buildmiljøet og cron hvert minut. PEJLO_BATTERY_DEVICES skal fortsat indeholde 080608317309. Ingen ny secret eller manuel database-migration kræves.
3. Udgiv både API og web med det normale build. Kontroller version 0.8.57 ved login og i appens footer. Dist indeholder de ændrede webfiler; den eksisterende kortkonfiguration er ikke med i ændringspakken. Et nyt build skal fortsat bruge kortnøglen.

D1-politikker opdeles efter serverkilde, tracker og ejer. Ejerskab og serverens godkendte tracker-id'er kontrolleres ved automatiske handlinger. API og cron deler lås, så samtidige ønsker ikke sender dobbelt. Kontosletning fjerner politikken.

## Første afprøvning

1. Bevar enhedens aktuelle UTC-indstilling fra 24. november cirka 08:40. Kontroller stadig tidspunktet efter næste genforbindelse. Send ikke daglige tidskommandoer på baggrund af denne udgivelse.
2. Med trackeren online under opsyn: vælg Normal 60 sekunder. Vent mindst et minut, start Find i 5 minutter og luk appen. Kontroller i loggen, at F115-ønsket skifter til 30 og senere tilbage til 60. Minutkontrol og offline kan forskyde tilbagevendingen.
3. Hent seneste intervalønske og batterihistorik. Efterprøv faktisk interval i rå rapporter; ekstra rapporter kan forekomme.
4. Gem mindst tre forskellige målinger inde og tre ude under Profil. Aktiver derefter automatik under Tracker. Kontroller skiftet til 120 ved et stabilt hjemmemønster og tilbage til 60, når mønstret er ude eller usikkert. Afprøv først under opsyn.
5. Ved uafklaret afsendelse: kontroller Traccar-log og indstilling. Vælg derefter et manuelt interval efter mindst et minut; det afbryder automatik. Gentag ikke kommandoer blindt.

Trackeren blev opladet natten til 24. november indtil cirka 06:30. Batterigevinst er endnu ikke målt; 100 % alene dokumenterer ingen besparelse. Sammenlign senere procentfald med fast interval og korrekte tidsstempler. Se [batteri- og kommandovejledningen](batteri-og-kommandoer.md).

## Validering

225 automatiske tests består efter build. De nye testforløb dækker tilbagevending med lukket app, offline, uafklarede afsendelser, stop under minutbegrænsning, manuelt override, samtidige ønsker, Wi-Fi-indlæring, genbrugte/gamle målinger, kilde/ejeradskillelse, rettigheder og kontosletning. En eksisterende API-test er opdateret med feltet lastWifi, som allerede var i API-svaret før denne version.

Den nye automatik er ikke testet mod den fysiske tracker eller i en rigtig browser i dette udviklingsmiljø. Cloudflare-udgivelse og den fysiske kontrol ovenfor udestår. Der er ingen påstand om længere batteritid eller aktiv hardwaredvale.
