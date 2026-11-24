# Pejlo 0.8.68 – statusikoner i profilfeltet

Upload filerne med samme mapper oven på 0.8.67 i GitHub, og lad det normale Cloudflare-build udgive appen. Åbn appen igen og kontrollér version 0.8.68. Der kræves ingen ændringer af Firebase, secrets, bindings eller statuslæseren på Traccar-serveren.

Statuslinjen ligger **inde i det valgte profilfelt, lige under navnet ved siden af billedet**. Navn, foto og profilvalg fungerer som før. Ikonerne følger den valgte profil og opdateres med de eksisterende trackerdata. Der sendes ingen ekstra kommandoer til trackeren.

| Ikon | Betydning |
| --- | --- |
| Måne | Frisk dvalerapport, som ikke er efterfulgt af en nyere fuld rapport. Grå, når den aktuelle dvale er ukendt. |
| Puls | Aktiv rapportering inden for fem minutter fra en online tracker. Dette beviser ikke fysisk bevægelse eller vågenhed. Rød ved offline. |
| Satellit | Frisk, godkendt GPS-position. Rød ved en frisk måling med nul satellitter, tidsfejl eller uafklaret GPS-position. |
| Signalstreger | Trackerens mobilnet, ikke telefonens. Antal streger følger den rapporterede RSSI-skala. |
| Wi-Fi-buer | Frisk registrering af hjemmets valgte Wi-Fi-punkter; buerne følger styrken. Manglende scanning er grå. |
| Batteri | Fyldet følger den seneste målte procent. Grøn over 20 %, rød ved 20 % eller derunder. |
| Lyn | Grøn under opladning, rød når den ikke oplader. Grå hvis oplysningen mangler eller er gammel. |

Grøn viser en bekræftet tilstand eller et brugbart signal. Rød betyder den modsatte tilstand, et svagt signal eller et problem; et rødt lyn betyder blot, at der ikke oplades. Grå betyder ukendt, manglende eller for gammel måling. Ikonernes betydning afhænger derfor også af symbolet. Dvale udledes aldrig af tavshed, og rapportering udlægges ikke som bevægelse.

SVG-ikonerne har et enkelt udtryk med signalstreger, Wi-Fi-buer og batterifyld. Hvert ikon har en beskrivende titel og en oplæsningsetiket. De eksisterende detaljerede trackeroplysninger er fortsat tilgængelige.

Test: 330 Node-tests bestået inklusive 12 Python-tests af statuslæseren. De nye kontroller dækker profilskift, demo, gamle målinger, offline, ukendt dvale, fysisk aktivitet kontra rapportering og tilgængelige ikonbeskrivelser.
