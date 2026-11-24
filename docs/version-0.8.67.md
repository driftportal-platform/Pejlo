# Pejlo 0.8.67 – automatisk anslået hvile

Upload de ændrede filer med samme mapper oven på 0.8.66 i GitHub. Lad det normale Cloudflare-build udgive API og app sammen. Åbn appen igen og kontrollér version 0.8.67. Ingen nye Firebase-indstillinger, secrets, bindings eller manuelle databasekommandoer kræves. Den allerede fungerende pejlo-status-service og PEJLO_STATUS_KEYS genbruges.

## Aktivér for Loui

1. Vælg Loui under Indstillinger → Navn og anvendelse.
2. Vælg **Påsat** under Trackerens brug og tryk **Gem profil**. Når den tages af, skal dette ændres til Taget af.
3. Åbn Ture → Motion og hvile. Automatisk hvile er slået til som standard. Under Kilometermål og automatisk hvile kan den slås fra igen med Gem valg.
4. Hent motionshistorikken igen efter nye dvalerapporter. Dagens samlede hvile vises i statusfeltet, dagstabellen og grafen.

Hvilen begynder med nye, dokumenterede intervaller efter udgivelsen og bekræftelsen af, at trackeren er påsat. Ældre modtagne loglinjer bruges ikke til at tilbagedatere påsat-status. Der tilføjes derfor ikke automatisk to timers hvile fra samtalen. Disse kan registreres manuelt.

## Sådan tælles hvile

- En kort 0x0210-dvalerapport er evidens for mulig hvile. Heartbeats alene bekræfter ikke dvale.
- Trackeren skal være bekræftet påsat, og en rapport inden for 15 minutter skal vise, at den ikke oplader.
- Estimatet tæller kun mellem faktisk modtagne rapporter, højst 15 minutter efter en dvalerapport og seneste oplysning om, at den ikke oplader. Et hul over 15 minutter tælles ikke som hvile. Der lægges ikke tid til efter sidste rapport.
- En almindelig positionsrapport eller et svar på en positionsforespørgsel beviser ikke, at dyret er vågent. Opladning, aftagning eller en eksplicit bevægelsesoplysning stopper estimatet.
- Dette er et forsigtigt estimat, ikke målt søvn eller et komplet døgnregnskab. Ikke-dækket tid er ukendt.
- Perioder fordeles efter dansk dato, også ved sommertid. Beregningen påvirker ikke trackerens firmware eller GPS-positioner.

## Ret dagens total

Registrer eller ret en dag viser den anslåede hvileværdi, hvis der ikke er en manuel værdi. Gem den ønskede **samlede** hvile for dagen. Den manuelle total erstatter estimatet; de lægges ikke sammen. 0 er en bevidst nulværdi. Et tomt felt eller sletning af den manuelle registrering bruger det automatiske estimat igen, hvis det findes. CSV viser både total, kilde og det underliggende estimat.

## Data og adgang

Kun beskedtype, modtagelsestid, opladning og eventuel eksplicit bevægelse arkiveres til hvileberegningen. Ingen rå pakker eller koordinater føjes til dette arkiv. Arkivet ligger i D1, afgrænset til ejer, profil, tracker og den aktive Traccar-server; rapporter beholdes i op til 90 dage. Manuelle dagstal følger den eksisterende lagring. Læse- og redigeringsrettigheder genbruges. Profil- og kontosletning rydder også hviledata.

## Valgfri opdatering af statuslæseren

Den installerede 0.8.66-læser leverer allerede de nødvendige dvale- og opladningsoplysninger. Den nye læser kan desuden videresende 0xE5, hvis firmwaren sender en eksplicit bevægelsesoplysning. Den udleder aldrig bevægelse af manglende satellitter. Efter GitHub-upload kan læseren opdateres uden at indtaste nøglen igen:

```sh
cd ~/traccar-status
curl -fLo bridge.py https://raw.githubusercontent.com/driftportal-platform/Pejlo/main/scripts/traccar-status/bridge.py
python3 -m py_compile bridge.py && sudo install -m 0755 bridge.py /opt/pejlo-status/bridge.py && sudo systemctl restart pejlo-status
sudo journalctl -u pejlo-status -n 10 --no-pager
```

Opdateringen bevarer /etc/pejlo-status.json og indeholder User-Agent-rettelsen fra 0.8.66. Det er ikke nødvendigt at geninstallere servicen.
