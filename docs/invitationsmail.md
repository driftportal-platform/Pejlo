# Pejlo 0.7.3 – automatisk invitationsmail

Upload hele pakken til GitHub som hidtil. Mailfunktionen bruger Resend. Den kan først sende rigtige invitationer, når følgende engangsopsætning er gennemført.

## Opsæt afsender

1. Opret en konto på https://resend.com.
2. Tilføj et domæne eller underdomæne, du ejer, under Domains. Du kan fx bruge et underdomæne til DriftPortal, hvis du styrer dets DNS. Dette er kun et eksempel; ingen domæner eller DNS-poster er oprettet automatisk.
3. Indsæt præcis de DNS-poster, Resend viser, hos domænets DNS-udbyder. Afvent Verified. Behold eksisterende mail- og DNS-poster; erstat dem ikke med generiske eksempler.
4. Opret en API-nøgle med adgang til at sende fra det verificerede domæne. Gmail/Hotmail-adresser er ikke dit eget afsenderdomæne.

Officiel vejledning: https://resend.com/docs/dashboard/domains/introduction

## Cloudflare → pejlo → Settings → Runtime variables and secrets

Tilføj i Production:

| Navn | Type | Indhold |
| --- | --- | --- |
| RESEND_API_KEY | Secret | Resend-nøglen, kun selve værdien |
| MAIL_FROM | Variable | En ren afsenderadresse på dit verificerede domæne, fx pejlo@DIT-VERIFICEREDE-DOMÆNE |

Gem/deploy indstillingerne. Behold alle eksisterende Traccar-, VAPID-, database- og kortindstillinger. Nøglen må ikke sættes i frontendfiler eller GitHub.

## Brug

Under Indstillinger → Familiedeling vælger ejeren modtagerens e-mail og trykker **Send invitation**. Mailen indeholder et link til Pejlo og invitationskoden. Linket åbner invitationsfeltet; det giver ikke i sig selv adgang. Modtageren logger ind/opretter konto med den inviterede e-mail, bekræfter sin mail og trykker Tilføj delt profil.

Koden gælder fortsat i 7 dage og er bundet til modtagerens bekræftede e-mail. Den kan kun bruges én gang. Ejeren kan annullere invitationen. Delingen giver adgang til position/historik og redigering af profil/geofences, som før.

Der kan sendes én invitation per ejer per minut. Mailen sendes til én modtager ad gangen. Ingen kopier til administratoren. Linket går til den eksisterende adresse https://pejlo.driftportal-platform.workers.dev; hvis appen senere flyttes til et andet domæne, skal mailens link opdateres i apps/api/mail.js.

Ved manglende opsætning får ejeren en tydelig fejl. Hvis mailtjenesten ikke bekræfter afsendelsen, viser appen, at invitationen er oprettet, men mailen ikke er bekræftet sendt. Koden kan stadig gives manuelt; prøv eventuelt igen efter et minut. En ny invitation til samme e-mail erstatter den gamle kode.

Afsendelsesbekræftelsen betyder, at mailtjenesten har modtaget mailen, ikke at den med sikkerhed ligger i indbakken. Kontrollér også spam og mailtjenestens leveringslog. Der er ikke implementeret bounce-webhooks. Undlad at aktivere link-/kliksporing for invitationsmails, hvis mailudbyderen tilbyder det.

## Test efter opsætning

Send en invitation til en anden mail, kontrollér indbakke/spam, åbn linket, og acceptér på den korrekte konto. Kontrollér derefter delt adgang og tilbagekaldelse. De automatiske tests bruger simuleret mailtjeneste; ingen rigtig mail er sendt fra udviklingsmiljøet.
