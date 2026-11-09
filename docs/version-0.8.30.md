# Pejlo 0.8.30

På **/admin/** kan systemadmin rette kundens navn, pris, status og udløbsdato. For at sætte kundens adgang på pause vælges **Sat på pause** under **Loginadgang**, hvorefter kontoen gemmes. Abonnementets egen status styres i abonnementsfeltet.

For at slette et login sættes det først på pause. Åbn derefter **Slet kundens login**, indtast kundens e-mail, og vælg **Slet login permanent**. Pejlo afviser sletning af systemadmin og af kunder med ejerskab eller delt adgang til trackere. Sletningen fjerner Firebase-login og dermed kunden fra den aktive kundeliste. Abonnementsoplysninger og kundens øvrige data bevares.

For at rette, sætte login på pause og slette skal Google-tjenestekontoen have rollen **Firebase Authentication Admin** (`roles/firebaseauth.admin`) i Pejlos Firebase-projekt. Brug samme Cloudflare Secret `GCP_FIREBASE_AUTH_SERVICE_ACCOUNT` som til kundeoversigten.
