# Pejlo 0.8.62 - D1-profiler og gemte GPS-dagstal

Ændringspakken forudsætter 0.8.61 og er ikke automatisk udgivet. Den indeholder kun ændrede og nye filer.

## Installation

1. Upload filerne til samme mapper i GitHub-repositoriet. Udgiv API og web samlet gennem det normale Cloudflare-build.
2. Behold eksisterende DB-binding, secrets, Firebase-projekt, Firestore-regler, Cron Trigger og MAPTILER_API_KEY under Builds. Ingen ny binding eller manuel databasekommando kræves; nye tabeller oprettes automatisk ved brug.
3. Luk gamle appfaner og genåbn PWA på alle telefoner. Kontrollér 0.8.62 i loginvisningen. Firebase-login, e-mail og adgangskode er uændrede.
4. Første login læser det gamle Firestore-profildokument med brugerens eget verificerede ID-token, gemmer en importkopi i D1 og opretter kontoens private tilstand. Gamle Firestore-data slettes ikke. Ved læsefejl afbrydes importen; fejl bliver ikke til en tom konto.
5. Kontrollér Loui, foto, hjemmeområde, Wi-Fi-valg og delte rettigheder. Omdøb, genåbn på en anden enhed og kontrollér navnet. Åbn Ture og hent motionshistorik; gentag hentningen for at se genbrug af dagstal. Kontrollér også en profil uden tracker.

Der er ikke taget en produktionsbackup fra denne udviklingssession. Importkopien oprettes først ved det første login efter udgivelse. Eksisterende D1 og Traccar skal fortsat sikkerhedskopieres separat, fx via dine nuværende eksportværktøjer. En lokal kildekodepakke er ikke en databasebackup.

## Lagring

| Data | Placering |
| --- | --- |
| Login og adgangskode | Firebase Authentication |
| Private profiler og kontoens aktive profilvalg | D1: pejlo_account_state |
| Fælles trackerprofiler, navn, foto, hjemmeområde og Wi-Fi-opsætning | D1: pejlo_profiles, med eksisterende rettighedstabeller |
| Importkopi af gamle Firestore-profiler | D1: pejlo_state_imports |
| Manuelle dagstal, hvile og mål | D1: pejlo_activity_days og pejlo_activity_settings |
| Beregnede GPS-dagstal | D1: pejlo_activity_gps |
| Detaljerede GPS-positioner | Traccar, uændret |

De nuværende små JPEG-profilbilleder beholdes i profilen i D1. R2 er ikke indført og kræver derfor ingen opsætning. Lokale visningsvalg kan fortsat ligge i browseren. Firebase Authentication er stadig nødvendig; slet ikke projektet eller Firestore, før alle ønskede konti er overført og kontrolleret. Administrativ sletning rydder fortsat gamle Firestore-dokumenter og kræver de eksisterende tjenestekontorettigheder.

## Én kilde til fælles profiler

Kontoens private D1-række gemmer kun profiler uden tracker og den aktive profilreference. Fælles trackerprofiler indlæses fra den eksisterende autoritative pejlo_profiles-tabel og kan ikke ændres gennem kontoens private tilstands-API. Eksisterende familierettigheder og revisionskontrol bevares. En gammel Firestore-kopi overskriver aldrig en eksisterende fælles profil. En gammel profil med en tracker, som kontoen ikke længere har adgang til, overføres privat uden trackeradgang.

Browseren indlæser ikke Firestore SDK længere. API-ruten /api/account/state kræver verificeret login. Ændringer beskyttes af revisionskontrol; gamle eller parallelle gemninger bliver afvist. Profiler kontrolleres hvert minut i en synlig app; skjulte faner holder pause. En sessionsafgrænset ETag undgår at gensende uændrede billeder og profiler. Svar er no-store, og gamle kontosvar ignoreres efter logout. Overførslen bruger Firestores dokumenterede REST-understøttelse for Firebase ID-tokens og brugerens eksisterende Security Rules: https://firebase.google.com/docs/firestore/use-rest-api

## GPS-dagstal

/api/activity/gps kontrollerer adgang til den fælles dyreprofil og beregner distance, GPS-ro og observeret dækningsperiode på serveren. Dage følger dansk tid. Beregningen bruger det eksisterende GPS-filter, og forbindelser over fem minutter indgår ikke. Dagene beregnes uafhængigt, så genbrug ikke ændrer resultatet efter hvilken periode der vælges.

Dagstal er afledte data og kan beregnes igen ud fra Traccar. Et åbent døgn genbruges i op til to minutter; afsluttede døgn genbruges i et døgn og opdateres ved næste forespørgsel for at medtage forsinkede indberetninger. Overgang til afsluttet døgn tvinger en ny beregning. Cachekonteksten indeholder server, tracker, enhed, art, hjemmeområde og algoritmeversion. Trunkering ved mindst 10.000 rapportpunkter markeres og gemmes ikke som et komplet resultat. Upstreamfejl gemmes aldrig som nul aktivitet.

Ingen ny Cron Trigger er tilføjet: dagstal dannes, når motionsoversigten hentes. Der sendes kun dagstal til motionsoversigten; den almindelige rutevisning bruger fortsat Traccar-ruten. Manuelle dagstotaler har forrang, og manglende GPS bliver aldrig til hvile. Hvile er fortsat manuel. Normalniveau og adfærdsadvarsler er stadig kommende funktioner.

## Backup og tilbagevending

Firestores gamle profilkopi og D1-importkopien bevares under testen. Ved tilbagevending til 0.8.61 bruges Firestore igen; nye ændringer foretaget i D1 efter omlægningen bliver ikke automatisk flyttet tilbage. Gem derfor en D1-eksport, før en tilbagevending overvejes. Slet ikke pejlo_account_state eller importkopier som almindelig fejlsøgning. Kontosletning fjerner både privat D1-tilstand, importkopi og ejerens GPS-dagstal; profilsletning rydder den pågældende profils dagstal.

## Kontrol

Build, syntakskontrol og 301 automatiske tests er bestået. Nye tests dækker engangsoverførsel, kopi, kontoafgrænsning, kanoniske profiler, afvist adgang efter ophørt deling, samtidige ændringer, forsinkede svar efter logout, skjulte faner, betingede API-svar, cacheudløb, midnat, datamangler, server- og filterændring, trunkering og oprydning. Produktionens Firestore-regler, fysisk PWA-login og rigtige Traccar-data skal stadig kontrolleres efter upload.
