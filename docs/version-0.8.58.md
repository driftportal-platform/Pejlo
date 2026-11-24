# Pejlo 0.8.58 – Hurtig Wi-Fi-opsætning

Bygger på 0.8.57. Pakken indeholder kun nye og ændrede filer og er ikke udgivet automatisk.

## Brugerens forløb

- Start med trackeren inde. Guiden tæller tre nye, forskellige Wi-Fi-scanninger og gemmer dem automatisk.
- Loui-profilens allerede valgte punkter genbruges, så der ikke skal vælges adresser igen.
- Nye brugere får en liste med forslag: op til tre punkter set i alle tre scanninger og med gennemsnitlig RSSI på mindst -75 dBm markeres. Punkterne gemmes først, når brugeren bekræfter dem som hjemmets. Naboers netværk kan også være stærke. Manuelt valg er muligt; hvis et valgt punkt kun optrådte i enkelte af de første scanninger, indsamles flere passende målinger.
- Flyt trackeren udenfor nær huset, og tryk Trackeren er nu ude. Tre udemålinger gemmes automatisk. Målinger fra før trykket kan ikke blive mærket som ude.
- En gemt inde-del kan genbruges efter genåbning, så ude-delen kan færdiggøres senere.
- Genvej fra Wi-Fi-kortet og manuel opsætning samlet i et sammenfoldeligt afsnit.
- Kortet skelner mellem gemte hjemmepunkter, punkter der ikke var med i en frisk scanning, og en manglende frisk scanning. Gamle Wi-Fi-målinger vises fortsat med deres egen alder.

## Afgrænsning

Guiden kører kun i den åbne app og bruger de eksisterende trackerdata. Der sendes ikke ekstra poll-kald eller kommandoer for at fremtvinge scanning, ændre interval, styre dvale eller ændre tidszone. En GPS-position er ikke en Wi-Fi-måling.

Målinger skal være højst to minutter gamle, inden for den eksisterende grænse for fremtidige tidsstempler og fra en online tracker. Første måling skal være fra efter delens start, og accepterede målinger skal være adskilt med mindst 20 sekunder. Skjult app, ugemte profilændringer eller manglende rettigheder pauser/stopper indsamling. En ufærdig del ligger kun i hukommelsen og indsamles højst 15 minutter; gemte dele ligger på den fælles profil. Gemmefejl gentages kun ved et eksplicit nyt forsøg.

Guiden genbruger den eksisterende rettigheds- og revisionskontrol for profilen. Den gemmer kun Wi-Fi-oplysninger og bevarer profilens øvrige indstillinger. Profil-/konto-/adgangsskift eller ændret Wi-Fi-konfiguration kasserer den gamle kladde. Ubekræftede nabopunkter gemmes ikke.

Genopsætning erstatter den gamle indlæring med den nye inde-del ved første gemning og med begge nye dele ved anden gemning. Derved mangler udemålinger midlertidigt; batteriautomatik falder tilbage til normalinterval ved usikker vurdering. Ved ens inde/ude-mønstre viser guiden usikkerhed i stedet for at love sikker indendørs placering. Ingen batteriautomatik aktiveres af guiden.

## Upload og kontrol

1. Upload de udpakkede filer til repositoryets rod med samme mapper oven på 0.8.57.
2. Bevar eksisterende Cloudflare-projekt, D1, secrets, kortnøgle i buildmiljøet og minut-cron. Ingen nye variabler eller databaseændringer kræves.
3. Lad det normale build og udgivelse køre, og kontroller version 0.8.58 ved login eller i footer. Kortkonfigurationen er ikke med i ændringspakken; et nyt build kræver den eksisterende MAPTILER_API_KEY.
4. Under Indstillinger → Profil startes Hurtig Wi-Fi-opsætning. På Loui genbruges de tre valgte punkter. Kontroller automatisk optælling og gemning inde, flyt ud og start ude-delen. Genåbn eventuelt appen mellem de to dele for at kontrollere Fortsæt.
5. Kontroller at de gemte målinger også findes efter genindlæsning. Batteriautomatik aktiveres særskilt under Tracker. Dvale afventer stadig fysisk afprøvning.

## Validering

240 automatiske tests består. De 15 nye dækker scanningers alder og tidsrækkefølge, genbrug, nye adresseforslag og bekræftelse, automatisk gemning, ude-start, gentagne scanninger, pauser, udløb, gemmefejl og eksplicit genforsøg, profil-/konto-/adgangsskift, fortsættelse samt usikker signalkvalitet. Eksisterende batteri-, GPS-, delings- og Wi-Fi-tests består. Build, JavaScript-syntaks og HTML-struktur er kontrolleret.

Guiden er endnu ikke afprøvet i rigtig browser/PWA eller mod Loui-trackeren i dette udviklingsmiljø. Fysisk scanningfrekvens og praktisk signalforskel skal kontrolleres efter upload. Manglende scanninger løses ikke ved at registrere GPS-punkter som Wi-Fi.
