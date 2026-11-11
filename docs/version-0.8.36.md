# Pejlo 0.8.36

Komplet pakke oven på 0.8.35. Ingen nye nøgler og ingen databasetrin.

## Sletning af en kunde rydder kundens data
Systemadmin kan stadig kun slette en kunde, der er sat på pause, har bekræftet e-mailen, ikke har tracker-adgang og ikke har et åbent køb eller et Stripe-abonnement. Nu sker der, før login slettes:

1. **Pejlos database:** kundens pushabonnementer og beskedkø, alarmindstillinger, pause, alarmarkiv, afsendte beskeder og mailgrænser, overdragelser, GPS-filter, områder og profiler, medlemskab, invitationer (både fra kunden og stilet til kundens e-mail), abonnement, abonnementsanmodninger og betalingsrække.
2. **Firestore:** dokumentet `users/<id>/private/state` med kundens profiler slettes med tjenestekontoen. Lykkes det ikke, vises en tydelig besked, og dokumentet skal slettes i Firebase-konsollen. For at det virker automatisk skal tjenestekontoen have Firestore-adgang (fx rollen *Cloud Datastore User*).
3. **Firebase-login** slettes til sidst. Fejler oprydningen i databasen, er login ikke slettet, og sletningen kan gentages.

Svaret fra `/api/admin/users` indeholder nu `cleanup`: `{rows, firestore: "deleted" | "manual"}`.

### Det sletningen ikke dækker
- **Positioner hos Traccar:** fjern kundens enhed eller historik i Traccar, når kunden ikke længere skal have den.
- **Stripe:** Stripe beholder betalingsoplysninger efter lovkrav. Slet kunden i Stripe, hvis det er muligt hos jer.
- **Sikkerhedskopier:** Cloudflare kan beholde gendannelsespunkter i en begrænset periode.

## Find, lyd og positionsanmodning
Hvis Traccar afviser en kommando eller ikke svarer, frigives spærren straks, så ejeren kan prøve igen (før: 10 minutter for Find, 30 sekunder for lyd, 1 minut for position). Svarer Traccar «sat i kø» (202), bevares spærren, fordi kommandoen stadig kan blive udført. Tabellen til positionsanmodninger oprettes nu kun én gang pr. Worker-instans.

## Afprøv
1. Opret en testkonto med en pushaktivering. Sæt den på pause, og slet den som systemadmin. Tjek beskeden om Firestore.
2. Sluk for trackerens forbindelse, og tryk Find. Tænd igen og tryk Find: det skal virke med det samme.
