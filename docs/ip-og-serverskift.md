# Pejlo vejledning til IP og serverskift

# Når den offentlige IP ændres

Brug denne vejledning, når internetudbyderen ændrer den offentlige IP, mens pc og domæne er de samme. Sidst registrerede IP var 188.228.64.102; den er ikke garanteret fast.

| Sted | Hvad ændres ved ny offentlig IP |
| --- | --- |
| DuckDNS | DNS-posten for pejlo skal følge den nye offentlige IP. |
| Google Geolocation-nøgle | IP addresses skal tillade Traccar-pc’ens nye udgående offentlige IP. |
| Router | Kontrollér WAN-adgang og portregler; LAN-målet ændres kun, hvis pc’ens lokale IP ændres. |
| Trackerens servernavn | Ingen ændring, når pejlo.duckdns.org og port 5015 bevares. |
| Pejlos servervalg | Ingen ændring, når HTTPS-navn og token stadig virker. |
| Cloudflare og Firebase | Ingen ændring af login-, push- eller mailnøgler alene på grund af ny IP. |

1. Find den nye offentlige IP i routerens WAN-/internetstatus. Kontrollér, at forbindelsen stadig giver indgående adgang; et skift til CGNAT eller dobbelt NAT kan kræve hjælp fra udbyderen.
2. Åbn Windows Opgavestyring → PejloDuckDNS → Kør. Kontrollér seneste resultat og DNS: Resolve-DnsName pejlo.duckdns.org. Den registrerede opgave kører også automatisk hvert femte minut.
3. Google Cloud → pejlo-a1fed → APIs & Services → Credentials → den separate Geolocation-nøgle → Application restrictions → IP addresses. Erstat gammel adresse med den nye offentlige udgående IP, og gem. Trackerens mobilnet-IP er ikke den rigtige adresse her.
4. Kontrollér routerens TCP 80, 443 og 5015 mod den rigtige LAN-IP samt Windows Firewall. Test derefter HTTPS fra telefonen på mobildata, ikke kun fra hjemmets Wi-Fi.
5. Kontrollér en ny fysisk GPS-position i Traccar og Pejlo. Test Google-opslag uden GPS særskilt; nøglens ændringer kan bruge nogle minutter på at slå igennem.

Ændres kun pc’ens lokale IP på samme internetforbindelse, er routerens mål det vigtigste. Google-listen skal kun ændres, hvis den udgående offentlige IP også ændres. DuckDNS’ automatiske opdatering retter ikke Googles tilladte IP-liste. [5]


# Skift tilbage til demo serveren

Eksemplet bruger den tidligere demo3-server. Kontrollér først, at din konto og de ønskede trackere stadig findes på den server. Et Pejlo-login er ikke et Traccar-login.

1. Notér den nuværende aktive server, og gem tokenet privat. Tag backup af den lokale Traccar-installation, hvis du vil bevare dens historik. Gem også den fungerende tidszone for trackeren.
2. Log på https://demo3.traccar.org med din demo-konto. Kontrollér, at 080608317309 findes og er tilgængelig for kontoen. Opret tilsvarende enheder for alle Pejlo-trackere, der skal med. En enhed, der ejes af en anden demo-konto, skal frigøres eller deles korrekt først.
3. Opret eller find et API-token på demo-serveren fra den rigtige konto. Tokenet til din egen Windows-server kan ikke antages at virke på demo-serveren.
4. Send SMS til den afprøvede Q8: SL DPdemo3.traccar.org#5015# . Bekræft svaret med SL CX. Flyt hver tracker til den nye server. Kontrollér ny kontakt og en frisk, korrekt tidsstemplet GPS-position i demo-serverens webvisning.
5. I Pejlo /admin/ → Traccar-forbindelse: adresse https://demo3.traccar.org, demo-token, Test forbindelse og Aktivér testet server. Vent på næste appopdatering og baggrundskørsel.
6. Kontrollér profil, placering, tid og batteri i Pejlo. Afprøv en ny områdepassage og push. Eksisterende Pejlo-ejere og profiler bevares, fordi de bruger samme unikke tracker-id. GPS-filteret starter separat for den nye aktivering.

## Det der ikke flyttes automatisk

- Traccars rå GPS-historik ligger på hver server. Den overføres ikke ved at ændre URL eller sende SMS. Pejlos D1-alarmarkiv og Firestore-profiler bevares, men dagens rute hentes fra den nye server.
- Du kan normalt ikke styre demo-serverens globale Google-nøgle, database eller geolocation-indstillinger. Overfør ikke din private Google-nøgle til et offentligt demo-setup.
- Demo-serveren er en ekstern tjeneste. Konto, adgang og retention skal kontrolleres. Egen Caddy, DuckDNS og routerportene bruges ikke af trackeren, mens den sender direkte til demo3.

Tilbage til egen server: bekræft den lokale server, send SL DPpejlo.duckdns.org#5015# og få et nyt GPS-punkt dér. Test og aktivér derefter https://pejlo.duckdns.org med det lokale token i Pejlo. At ændre TRACCAR_URL i Cloudflare alene tilsidesætter ikke et aktivt adminvalg.


# Flyt Traccar til en anden pc

Flyt i første omgang til samme Traccar-version som den gamle pc. Skift ikke databaseformat og serverversion samtidig med flytningen. De faktisk installerede versionsnumre skal noteres før arbejdet.

1. På gammel pc: tag backup af traccar.xml, hele data-mappen, media hvis brugt og øvrige tilrettede filer. H2 skal kopieres, mens traccar-tjenesten er stoppet. Start den igen, hvis der går tid før selve flytningen.
2. Gem Caddyfile, HTTPS-/certifikatdata og tjenesteopsætning samt DuckDNS-script og opgave. Notér pc-navn, LAN-IP, routerportregler, tjenesternes startkonto og Google-nøglens tilladte IP. Behold en kopi af den gamle installation.
3. Installér samme Traccar-version på ny pc. Stop dens traccar-tjeneste. Gendan kopier af konfiguration, data og eventuelt media. Ret kun nødvendige lokale stier og filrettigheder. Del aldrig den samme H2-fil mellem to kørende installationer.
4. Genskab PejloCaddy med proxy til 127.0.0.1:8082 og samme domæne. Flyt Caddys nødvendige certifikatdata med korrekte rettigheder eller lad Caddy udstede på ny, når domæne og porte peger rigtigt. Genskab PejloDuckDNS og Windows Firewall.
5. Ved endeligt skift: stop den gamle Traccar, og tag en sidste konsistent backup. Gendan den på ny pc. Ret routerens TCP 80, 443 og 5015 til den nye pc’s reserverede LAN-IP. Start tjenesterne på ny pc. Undgå to DuckDNS-opgaver, der kæmper om samme navn fra forskellige internetforbindelser.
6. Er den offentlige IP ændret, følg IP-vejledningen og ret Google-nøglens IP-liste. Er domænet ændret, ret Caddy og DuckDNS, send trackerens nye serverkommando, og test/aktivér den nye HTTPS-adresse med dens token i Pejlo.
7. Kontrollér fra telefonens mobildata: HTTPS-login, ny GPS, korrekt tid, historik, Pejlo-visning og en ny pushalarm. Genstart pc’en og kontrollér automatisk opstart, DNS-opgave og drift uden åben browser.

Samme domæne, port og gendannet database: trackeren behøver normalt ingen ny SMS. Pejlo behøver normalt heller intet nyt servervalg, hvis det eksisterende token virker efter gendannelse. Ved tom ny database skal samme tracker-id’er oprettes, et token fra den nye konto bruges, og serveren testes og aktiveres igen.

Tilbagerulning: stop den nye installation. Ret router/DNS tilbage til gammel pc, start den gamle tjeneste og kontrollér nyt GPS-punkt. Hvis Pejlos servervalg blev ændret, aktivér den gamle adresse og dens token igen. Gem data fra begge installationer; historik fra flytteperioden flettes ikke automatisk. [6]
