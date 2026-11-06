# Pejlo 0.8.6 – login uden ubrugt Google-kode

Komplet pakke med alle funktioner fra 0.8.5.

- **Firebase Auth oprettes nu med `initializeAuth`** i stedet for `getAuth`. `getAuth` indlæser automatisk Googles popup/redirect-kode fra `apis.google.com` og en skjult iframe. Pejlo bruger kun e-mail og adgangskode, så den kode er ikke nødvendig. Login, «husk mig», bekræftelsesmail og nulstilling af adgangskode bruger de samme funktioner som før.
- **Testpolitikken (CSP) er strammet:** `apis.google.com` er fjernet fra `script-src`, og `frame-src` er `'none'`. Den er stadig kun Report-Only.
- Ingen nye nøgler, ingen databaseændringer.

## Afprøv efter upload (vigtigt)

1. Genåbn PWA'en og kontrollér versionsmærket 0.8.6.
2. Log ud og ind igen, med og uden «Husk mig». Luk appen helt og åbn den igen: er du stadig logget ind (med «Husk mig»)?
3. Opret en testkonto, bekræft e-mailen, og prøv «Glemt adgangskode».
4. Tjek konsollen (på computer): der skal ikke komme CSP-meldinger om `apis.google.com`. Kommer der stadig andre, noter dem.
5. Går noget galt med login, kan man rulle tilbage til 0.8.5 uden databasetrin.

Først når punkt 2–4 er rene i en uges tid, skiftes headeren fra `Content-Security-Policy-Report-Only` til `Content-Security-Policy`.
