# Pejlo 0.8.4 – samlet funktions- og layoutversion

Denne pakke fletter layoutet fra den uploadede 0.8.3 ind i den komplette 0.8.1. Versionsnumrene i de to grene beskrev forskellige ændringer; 0.8.4 samler dem.

## Med fra layoutpakken

- Fem indstillingsfaner: Profil, Område, Beskeder, Deling og Tracker.
- Profilvælger som dialog med profilkort, nu også med profilfoto.
- Statuslinje på Ture, Find og Indstillinger. Den bruger den eksisterende hjemmestatus, så en gammel position får “Sidst set hjemme”.
- Fast Find-knap på mobil og foldbare hjælpetekster.
- Kompakt Ture-side med datofelter, afspilning og foldbar tidslinje. Alarmarkivet er bevaret som særskilt sektion.

## Bevarede funktioner

Foto, skærmlås under Find, separat trackerkontakt, GPS-alder, forsigtig bevægelsesretning, afstandscirkler og hjemmelinje, navngivne cirkler/polygoner, fælles roller, push, 90-dages alarmarkiv, pause af egne beskeder, administratorstatus, QR-/linkparring og rettelserne til invitationsmail følger alle med fra 0.8.1.

“Indstil hjemmeområde” vælger nu fanen Område før formularen vises. Notifikationens pausehandling åbner Beskeder, og et parringslink åbner Tracker. Profilvælgerens dialog lukker og tømmes ved logout.

## Upload

Upload hele pakkens indhold til det eksisterende GitHub-repository som hidtil. Ingen nye nøgler eller ændringer af Firebase-regler er nødvendige. Behold database, Cron Trigger hvert minut og alle eksisterende variabler. De tidligere migrationer og automatisk oprettelse af manglende tabeller følger med.

Se også [funktioner fra 0.8.0](version-0.8.md) og [funktioner fra 0.8.1](version-0.8.1.md).

Efter deployment genåbnes PWA'en. Kontrollér versionsmærket 0.8.4, faneskift, profilvælger, foto og alarmarkiv. Live push, mail, QR-scanning og den fysiske tracker skal fortsat afprøves på telefonen.
