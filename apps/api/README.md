# Pejlo API

Cloudflare Worker ESM, native fetch og Web Crypto; ingen serverafhængigheder. D1-binding `DB`. Firebase-projektets offentlige webkonfiguration genbruges kun til Googles tokenopslag.

| Endpoint | Adgang | Funktion |
| --- | --- | --- |
| GET /api/trackers | Bekræftet Firebase-konto | Kun egne trackere; UID og adminflag |
| POST /api/trackers/claim | Bekræftet Firebase-konto | ID + parringskode; atomisk ejerregistrering |
| GET /api/tracker?identifier=… | Registreret ejer | Saniteret position, status, batteri og dagens UTC-punkter |
| POST /api/admin/trackers | Kun runtime-konfigureret administrator-UID | Klargør ID i Traccar og generér kryptografisk parringskode |

Tokenopslag udføres på serveren via Firebase accounts:lookup med requestens Firebase ID-token. Ugyldige, udløbne, deaktiverede og ubekræftede konti afvises. Traccar-tokenet sendes kun til testserveren i Authorization-headeren. Redirects afvises. Ingen rå fejl, tokens, telefonnumre eller andre enheder returneres.

Klientens profilvalg er ikke en tilladelse. Den servervaliderede Firebase UID skal eje det valgte ID i D1. En betinget UPDATE ... RETURNING sikrer, at to konti ikke kan tage samme enhed. Parringskoden har 128 bits tilfældighed og lagres hashed. Generiske kodefejl skjuler forskellen på ukendt ID, forkert kode og allerede tilknyttet enhed.

Alle API-svar har Cache-Control: no-store. Ingen CORS-tilladelse til andre origins. Google- og Traccar-kald har timeouts. Positionshistorik er begrænset til indeværende UTC-dag og de seneste 2000 gyldige punkter. API'et har ikke deling, overdragelse, kodegendannelse eller kommandoer til enheder.

Dokumentation: https://firebase.google.com/docs/reference/rest/auth#section-get-account-info ; https://www.traccar.org/traccar-api/ ; https://developers.cloudflare.com/d1/get-started/ .
