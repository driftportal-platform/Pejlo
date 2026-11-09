# Pejlo 0.8.29

På **/admin/** viser abonnementsoversigten kunde, abonnement, status, aftalt pris i danske kroner, prisperiode, udløbsdato og dage tilbage. Tryk på kunden for at redigere aftalen. Oversigten sorterer de indlæste kunder efter udløbsdato. Vælg **Vis flere** for at hente næste side.

Pris er valgfri. Brug fx **49,95** og **Pr. måned**. Et tomt prisfelt betyder, at prisen mangler. **0,00** betyder gratis. Udløbsdatoen gælder til og med den valgte dag i Danmark. Priser og datoer registreres manuelt. Eksisterende abonnementer får tomme prisfelter ved den automatiske D1-opgradering.

## Slå kundeoversigten til

Hvis siden viser, at **GCP_FIREBASE_AUTH_SERVICE_ACCOUNT** mangler, er systemadmin-login i orden. Kundelisten skal have adgang til Firebase Authentication.

1. Opret en særskilt tjenestekonto i Google Cloud-projektet **pejlo-a1fed**.
2. Giv kontoen rollen **Firebase Authentication Admin** (`roles/firebaseauth.admin`) i projektet.
3. Opret en JSON-nøgle til tjenestekontoen.
4. Åbn **Cloudflare → Workers & Pages → pejlo → Settings → Variables and Secrets**. Opret en **Secret** med navnet `GCP_FIREBASE_AUTH_SERVICE_ACCOUNT`. Indsæt hele JSON-indholdet og gem. Nøglen hører hjemme i Cloudflare og skal holdes ude af kildekoden.
5. Genindlæs **/admin/**, og vælg **Hent brugere**.
