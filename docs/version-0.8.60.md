# Pejlo 0.8.60 – motion og hvile til dyreprofiler

Bygger på 0.8.59. Ændringspakken indeholder kun nye og ændrede filer. Den er ikke automatisk udgivet.

## Funktioner

Under Ture vises Motion og hvile for Kat, Hund, Hest og Andet dyr. Genstandsprofiler får ikke afsnittet. Der er valgfrit dagligt kilometermål, registrering og rettelse af en dags samlede kilometer og observeret hvile, note, historik for valgte datoer samt CSV. Data kan registreres manuelt også uden tracker og uden Traccar-adgangsnøgle. Datoer er danske kalenderdage; højst 31 dage hentes ad gangen. Værdier er i kilometer og timer, og tomme felter forbliver ukendte.

En tracker kan levere GPS-estimater via den eksisterende filtrerede historik. Afstand beregnes mellem godkendte punkter, med en nedre bevægelsesgrænse på 10 meter og den eksisterende hastighedsgrænse for dyretypen. Forbindelser over fem minutter og over dansk midnat medregnes ikke. Dubletter, ugyldige, omtrentlige og fremtidige punkter udelades. Det er et groft estimat, ikke en komplet måling af motion. Traccars eventuelle grænse på 10.000 punkter markeres i oversigten.

En manuel dagstotal har forrang over GPS-estimatet, så samme bevægelse ikke lægges sammen to gange. GPS-ro er tiden mellem brugbare nærliggende punkter og kan også være vågen aktivitet på lille område. Den er tydeligt adskilt fra ejerens observerede hvile. Manglende GPS-data bliver aldrig til hvile eller et konstrueret nulforbrug. Ingen måling af søvn eller kalorier er tilføjet.

Kilometermål er brugerens eget valg. Ved første dagsregistrering gemmes det daværende mål som historisk reference. Ændring af det aktuelle mål ændrer ikke de allerede gemte dagsreferencer. CSV henter den viste oversigt; den bruger UTF-8, semikolon og decimalkomma. Noter citeres, og indledende regnearksformler neutraliseres.

## Dyrevejledning

Rådene er generelle, uden et fast automatisk kilometermål. De bygger på disse primære dyrevelfærds- og veterinærkilder, kontrolleret 24. november 2026:

- Kat: PDSA, korte lege fordelt over dagen og ingen specifik motionsmængde, der passer til alle katte: https://www.pdsa.org.uk/get-involved/our-campaigns/weigh-up/your-cat/your-cats-body-shape/how-to-exercise-your-cat
- Hund: PDSA, individuelt behov efter race, alder og helbred: https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/how-much-exercise-does-your-dog-need
- Hest: British Horse Society, bevægelsesmuligheder, foldtid og social kontakt: https://www.bhs.org.uk/horse-care-and-welfare/ownership-loaning/where-to-keep-your-horse/

Andet dyr er for bred en kategori til en bestemt numerisk anbefaling. Appen foreslår individuel rådgivning frem for at gætte et mål for arten. Kildelinks vises i brugerfladen.

## Data og adgang

GET/POST /api/activity håndteres efter verificeret login og før Traccar-konfiguration. Tabellerne pejlo_activity_settings og pejlo_activity_days oprettes automatisk. Nøglen er ejerens bruger-id og profil-id; derved kan en privat profils data følge med, når samme profil får sin første tracker. Andre brugeres private data kan ikke vælges gennem klientens bruger-id. Tilknyttede profiler bruger registerets aktuelle ejer og profiltype, og serveren kontrollerer medlem/rolle. Delte redaktører kan skrive, læsebrugere kun læse. Numeriske grænser, datoer, notelængde og revisioner valideres på serveren. Revisioner afviser samtidige overskrivninger. Brugerindtastninger vises som tekst.

Profilfjernelse rydder motionsdata, mens det at forlade en delt profil bevarer ejerens historik. Kontosletning rydder ejerens poster og fjerner forfatter-id fra bidrag til andres historik. GPS-punkter ændres eller slettes ikke af motionsdelen. Hverken trackerinterval, dvale, positionskontrol eller Wi-Fi-indstillinger ændres af denne version.

## Upload og første kontrol

1. Upload de udpakkede filer til repositoryets rod med samme mapper oven på 0.8.59. Udgiv både API og web med det normale build.
2. Bevar Cloudflare Worker, D1, secrets, kortnøgle i buildmiljøet og minut-cron. Ingen nye nøgler, variabler eller manuelle migrationer kræves. Kortkonfigurationen er ikke med i ændringspakken; et nyt build bruger fortsat MAPTILER_API_KEY.
3. Kontroller version 0.8.60. Vælg Loui og åbn Ture. Vælg eventuelt eget mål, gem en dag med km/hvile og kontroller historikken efter genindlæsning. Hent GPS-oversigt og CSV. Kontroller at en bilprofil skjuler afsnittet.
4. Ved familiedeling kontrolleres læse-/redigeringsroller. Afprøv først med testtal, som bagefter kan slettes med Slet registrering.

## Validering

268 automatiske tests består, herunder 17 nye for mål, dagsposter, nuldistance og ukendte værdier, historiske målsnapshots, privat/fælles adgang, samtidige revisioner, profil-/kontosletning, datoer og inputvalidering, API uden Traccar, GPS-huller/spikes/midnat, CSV, bevarelse af formularudkast og profilskift. Build og JavaScript-syntaks er kontrolleret. Den nye brugerflade er endnu ikke afprøvet i rigtig browser/PWA eller med ny GPS-historik fra Loui i dette udviklingsmiljø.
