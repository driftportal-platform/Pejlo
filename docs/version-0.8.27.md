# Pejlo 0.8.27

Systemadmin har sin egen fane under **Indstillinger → Systemadmin**. Fanen samler brugere, abonnementer, driftsstatus, forbrug og klargøring af trackere. Pejlo kontrollerer systemadminrollen på serveren ud fra Firebase-brugerens UID og den eksisterende `TRACCAR_ADMIN_UID`. Roller på delte trackerprofiler ændres ikke af systemadminfanen.

## Sæt brugeradministrationen op

1. Opret en særskilt tjenestekonto i Google Cloud-projektet bag Pejlo.
2. Giv den rollen **Firebase Authentication Admin** (`roles/firebaseauth.admin`) i dette projekt.
3. Tilføj hele tjenestekontoens JSON-nøgle som Cloudflare Secret med navnet `GCP_FIREBASE_AUTH_SERVICE_ACCOUNT` på Pejlo Workeren. Den eksisterende nøgle til forbrugsmålinger kan fortsat have sin egen læserolle.
4. Log ind som den verificerede bruger med det UID, der står i `TRACCAR_ADMIN_UID`. Åbn **Systemadmin → Hent brugere**. Tjek også fra en almindelig konto, at fanen er skjult.

Abonnementstabellen oprettes automatisk i D1. Eksisterende brugere vises med **Intet abonnement**, indtil du registrerer en aftale. Loginkonto og abonnement har hver sin Gem-knap.

Brugere oprettet af systemadmin vælger **Glemt adgangskode?** ved login for selv at sætte deres adgangskode. Derefter logger de ind og bekræfter deres e-mail. Brugeren starter selv mailforløbet. Eksisterende selvoprettelse er fortsat mulig.

Udløbsdatoen gælder til og med den valgte dato i dansk tid. Overblikket markerer udløbne aktive abonnementer og prøveperioder. Abonnementet er et manuelt register. Betaling og loginspærring styres særskilt. Firebase-spærring blokerer ny loginadgang. Allerede udstedte Firebase-tokens til direkte Firestore-adgang kan virke frem til deres normale udløb.
