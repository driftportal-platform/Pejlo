# Pejlo 0.8.1 – pause, driftsstatus og nem parring

Komplet opdatering oven på 0.8.0. Foto, Find, alarmarkiv, geofences, familieroller, invitationsmail og alle tidligere funktioner følger med.

## Upload og opsætning

Upload hele pakkens indhold til det eksisterende GitHub-repository som hidtil. Ingen nye Cloudflare-nøgler, tjenester eller Firebase-regler er nødvendige. Behold databasen og alle eksisterende indstillinger. De nye tabeller oprettes automatisk. Migrationen `0004_snooze_operations.sql` er også med til installationer, der bruger D1-migrationer.

Cron Trigger skal fortsat være `* * * * *` (hvert minut). Genåbn PWA'en efter deployment. Versionsmærket skal vise 0.8.1. Notifikationsknapper kræver, at den nye service worker er aktiveret; luk eventuelt alle åbne Pejlo-vinduer og genåbn.

## Pause mine beskeder

Under Indstillinger findes knapper til 1, 4 og 12 timer samt Genoptag nu. Pausen gælder din konto for den valgte tracker på alle dine enheder. Du ser en nedtælling og et tidspunkt i dansk tid. Serveren bestemmer udløbet, så pausen også stopper, når appen er lukket. Status hentes ved profilskift, tilbagevenden til appen og hvert minut, mens appen er synlig.

Andres beskeder ændres ikke. GPS-data, geofenceovervågning og alarmarkivet fortsætter. Arkivet mærker hændelser som “Dine beskeder var sat på pause”. Pausen gælder også beskeder om en redaktørs områdeændring, men ikke en manuelt afsendt push-test.

Beskeder, der allerede er afleveret til push-tjenesten, kan stadig nå frem. Hændelser under pausen sendes ikke samlet bagefter; genoptagelse gælder fremtidige hændelser. Der er ingen fælles “pause for alle” i denne version.

## Handlingsknapper på notifikationer

Hvor browser og telefon understøtter det, vises Vis på kort og Pause 1 time… . Der tilbydes højst det antal knapper, browseren angiver. Uden understøttelse åbner et almindeligt tryk stadig den rette profil.

Vis på kort åbner profilen i den eksisterende app eller i et nyt vindue. Pause 1 time… åbner Indstillinger for profilen og beder dig bekræfte pausen efter login. Intet pauseres alene ved at åbne et link. Service workeren gemmer ingen login-token og foretager ingen ubekræftet ændring af alarmvalg. Pauseknapperne inde i appen virker uafhængigt af systemets notifikationsknapper.

Teknisk reference: https://developer.mozilla.org/en-US/docs/Web/API/Notification/actions

## Administratorens driftsstatus

Under Indstillinger, ved trackeropsætningen, findes Hent driftsstatus. Panelet er kun synligt for den konto, der allerede er angivet i `TRACCAR_ADMIN_UID`, og API'et håndhæver samme regel.

Panelet viser antal trackere, tilknyttede trackere, fælles profiler, aktive områder, pushenheder og beskeder i kø. Det viser også de seneste 20 baggrundskørsler, antal kontrollerede trackere, behandlingsfejl og antal fejlede Traccar-kald. Første kørsel efter opdateringen starter denne log; tidligere kørsler kan ikke genskabes.

Manglende nye kørsler i mere end tre minutter giver en tydelig besked om at kontrollere Cron Trigger og Cloudflare-logs. “Gennemført” beskriver den pågældende serverkørsel, ikke GPS-friskhed eller garanteret alarmlevering. Der kontrolleres fortsat højst otte trackere pr. kørsel, som i den tidligere version.

Konti med registrerede pushenheder vises med bruger-ID og antal enheder, højst 100 konti. ID kan sammenholdes med “Dit bruger-ID” på brugerens konto. En registrering beviser ikke, at browseren stadig modtager beskeder. Ingen pushadresser, abonnementnøgler, parringshashes eller rå fejltekster vises.

## Parring med QR-kode eller link

Når administratoren klargør en ny tracker, vises kode, et kopierbart parringslink og en QR-kode. QR-koden genereres lokalt med en medfølgende generator, uden at sende koden til en ekstern QR-tjeneste. Koden ligger i URL'ens fragment. Den fjernes fra adresselinjen ved åbning og holdes midlertidigt i fanens session, så login kan gennemføres.

Den kommende ejer scanner med telefonens almindelige kamera, åbner linket, logger ind og vælger eller opretter en tom profil. Derefter bekræfter vedkommende med Tilføj tracker til denne profil. Et link kan også indsættes i feltet Parringslink. Manuel indtastning af ID og kode er bevaret. Der tilføjes ingen separat kamerascanner inde i appen.

Et parringslink overtager aldrig automatisk en profil, der allerede har en anden tracker. Serveren kontrollerer stadig kode og ejerskab atomisk. Efter tilknytning kan en anden konto ikke bruge koden til at overtage trackeren. Del kun link og QR-kode med den tilsigtede ejer. Rydder man fanens session før tilknytning, må linket åbnes igen.

Eksisterende parringskoder kan fortsat indtastes manuelt; nye QR-koder og links vises ved klargøring. Administratoren kan ikke hente en gammel kode igen, fordi databasen kun gemmer dens hash. Deling af en allerede ejet tracker med familien sker fortsat gennem invitationer, ikke gennem parringskoden.

QR-generator: https://github.com/davidshimjs/qrcodejs (MIT; licens medfølger i `apps/web/src/vendor/QRCODE-LICENSE`). Kun en ES-moduleksport er tilføjet.

## Kort accepttest

1. Sæt dine beskeder på pause i en time, og kontrollér, at den anden konto fortsat får egne alarmer. Kontrollér arkivets pausestatus og prøv Genoptag nu.
2. Åbn driftsstatus som administrator. Afvent næste Cron-kørsel, og hent status igen. Kontrollér, at en almindelig konto ikke har panelet.
3. Klargør en testtracker. Scan QR-koden på en anden telefon, og bekræft parringen på en tom profil. Forsøg ikke at genoprette eller ændre en eksisterende tracker for denne test.
4. Send en push-test eller afvent en ny alarm. Kontrollér handlingerne på de telefoner, der understøtter dem. En push-test har ingen trackerhandlinger; de vises på egentlige trackeralarmer.

Samlet kort, gæsteadgang, eksport, opholdsalarm og kommandoer til Q8_H er ikke med i denne pakke.
