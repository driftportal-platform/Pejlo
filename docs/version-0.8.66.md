# Pejlo 0.8.66 – dvalerapport fra serverlog til app

Denne ændringspakke forudsætter 0.8.65. Den indeholder appændringer og en lille statuslæser, der skal installeres på Traccar-serveren. Appupload alene giver ikke dvaledata. Traccar skal ikke udskiftes eller genstartes, og trackeren får ingen nye kommandoer.

## Det appen viser

Under Trackeroplysninger, lige under profilens navn, vises én status ad gangen:

| Status | Betydning |
| --- | --- |
| Dvalerapport modtaget | En gyldig, kort 0210-rapport er modtaget inden for 15 minutter, uden en nyere fuld rapport bagefter. |
| Sender rapporter | En fuld 0200- eller 0201-rapport er modtaget inden for fem minutter. Det beviser ikke, at Loui er vågen. |
| Dvalestatus ukendt | Der er ikke frisk nok dokumentation til de to andre visninger. |

Offline vises udtrykkeligt som Offline · dvalestatus ukendt. Under overskriften står dato/tid for den senest modtagne dvalerapport. En nyere fuld rapport gør den aktuelle dvale uafklaret; den bruges ikke som bevis for aktivitet hos dyret. Heartbeats viser kontakt og forlænger ikke dvalebekræftelsen. Gamle målinger får aldrig et nyt måletidspunkt ved genstart, genforsøg eller genåbning af appen.

Rapporten tidsstemples efter modtagelsen i Traccar-loggen, med loggens tidszone Europe/Copenhagen. Trackerens tidligere fejl i dens egen tid påvirker derfor ikke denne status. I den tvetydige time ved skift fra sommertid til vintertid springes tidsstempler uden offset over frem for at gætte.

Dette er en status for trackeren. Automatisk hviletid er fortsat ikke aktiveret, og status ændrer hverken ruter, GPS-kilometer, registreret hvile eller påsatbekræftelsen. Der gemmes kun seneste tidspunkt pr. beskedtype; denne version er ikke et arkiv med alle dvaleperioder.

## Installation – trin for trin

1. Upload ændringspakken til samme mapper i GitHub, og lad det normale Cloudflare-build udgive web og API. Behold MAPTILER_API_KEY i buildmiljøet. Der skal ikke ændres noget i Firebase eller eksisterende bindings.
2. Kopiér mappen `scripts/traccar-status` fra pakken til din Linux-server, fx som `/home/stefan/traccar-status`. Følgende kommandoer køres i den mappe.
3. Lav en separat nøgle til Loui:

```bash
cd /home/stefan/traccar-status
python3 bridge.py --make-key 080608317309
```

Kommandoen viser én JSON-værdi med tracker-ID og en tilfældig nøgle. Kopiér hele JSON-værdien. Den skal holdes privat og skal ikke sendes i chatten.

4. I Cloudflare Worker **pejlo**: tilføj en **Secret** med navnet `PEJLO_STATUS_KEYS`. Værdien skal være hele JSON-værdien fra trin 3. Gem/udgiv indstillingen. Det er en ny, separat nøgle; den erstatter ikke TRACCAR_TOKEN, Firebase-login eller andre secrets.
5. Installér statuslæseren:

```bash
sudo bash install.sh
```

Installationen spørger om tracker-ID, Pejlo-appens Cloudflare/HTTPS-adresse, den aktive Traccar HTTPS-adresse og JSON-nøglen. Brug appens adresse ved første spørgsmål og Traccars adresse ved det næste; de er ikke nødvendigvis ens. Standardværdien for Traccar er `https://pejlo.duckdns.org`. Nøgleindtastningen skjules.

Installationen kontrollerer en signeret forbindelse mod Pejlo, før tjenesten aktiveres. Den kræver, at trackeren allerede er tilknyttet i Pejlo, og at Traccar-adressen matcher appens aktive server. Der skal være mindst én gyldig rapport fra det seneste døgn i loggens sidste 256 KB til forbindelsestesten. Ved fejl skal den oplyste årsag løses, før installationen køres igen.

Statuslæseren bruger Python 3.9+ og Linux-systemets tidszonedata. Den opretter brugeren `pejlo-status`, lægger programmet i `/opt/pejlo-status`, konfigurationen i `/etc/pejlo-status.json` og en systemd-tjeneste. Konfigurationen ejes af root og kan kun læses af statusbrugeren. Den eksisterende Traccar-log skal være læsbar for denne bruger; installationen ændrer ikke logmappens rettigheder. Tjenesten har ingen skriverettighed til Traccar.

## Kontrol og stop

```bash
sudo systemctl status pejlo-status --no-pager
sudo journalctl -u pejlo-status -n 20 --no-pager
```

Loggen fra læseren viser antal sendte beskedtyper eller en HTTP-fejlkode; den skriver ikke nøgler eller rå trackerdata. Åbn/genåbn Pejlo, vælg Loui, og åbn Trackeroplysninger. Seneste dvaletidspunkt kommer først, når en gyldig 0210-rapport er læst. En fuld rapport kan godt give Sender rapporter, mens Loui sover.

Stop læseren igen med:

```bash
sudo systemctl disable --now pejlo-status
```

Dette ændrer ikke Traccars drift eller trackerens indstillinger. Tidligere modtagne tidspunkter kan stadig ses som historisk seneste bekræftelse; aktuel dvalestatus bliver ukendt, når den ikke længere er frisk.

## Tekniske grænser og kontrol

Læseren validerer JT808-indramning, escaping, checksum, bodylængde og det nøjagtige tracker-ID. TCP-fragmenter og flere pakker i samme loglinje håndteres. Den følger logrotation og kan genindlæse de sidste 256 KB ved genstart. Kun metadata for kort 0210, 0200, 0201 og tomt 0002 videresendes; ingen koordinater eller rå pakker sendes videre.

Modtageren er `/api/tracker/report-state`. Alle poster signeres med HMAC-SHA256 og en nøgle knyttet til præcis ét tracker-ID. Forkert signatur, browser-Origin, ukendt/ikke tilknyttet tracker, gammel afsendelse, ugyldige tider og forkert aktiv server afvises. Hele batchen valideres før skrivning. Der accepteres højst fire poster og 4 KB pr. kald. Ældre gentagelser kan ikke overskrive nyere tidspunkter.

Seneste metadata gemmes i den eksisterende D1-binding og udleveres kun gennem den almindelige, adgangskontrollerede tracker-API. Servervalg adskiller gamle og nye serverdata. Metadata fjernes ved sletning af ejerens kontodata. En fejl i statuslæsningen stopper ikke eksisterende GPS-visning. Broen har kun adgang til statusmodtageren med sin nøgle; den har ikke Firebase- eller Traccar-adgangstokens.

Build og alle 319 Node-tests er bestået. Python-broens 10 regressionstests, som også køres gennem Node-testpakken, dækker de konkrete pakker fra loggen, checksum, escaping, fragmenter, forbindelsesadskillelse, dvalepakker kontra batchpakker, tidszone, tvetydig sommertid, signering, genforsøg og logrotation. Windows-udviklingsmiljøer skal have Pythons `tzdata` til rådighed for tidszonetestene; Linux bruger normalt systemets zoneinfo. Installation og løbende drift på Stefan-serveren er endnu ikke udført her.
