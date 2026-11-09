# Pejlo 0.8.31

**Mit abonnement** ligger ved siden af kontoens loginoplysninger i Pejlo. Kunden kan se sin egen plan, status og udløbsdato samt dage tilbage. Kunden kan sende en anmodning om forlængelse eller opsigelse og se, om den afventer eller er behandlet. Der kan være én åben anmodning pr. kunde.

Systemadmin finder indkomne anmodninger på **/admin/** under **Abonnementsanmodninger → Hent anmodninger**. Ret kundens aftale ved behov, og markér derefter anmodningen som behandlet. Dette er et manuelt forløb. Afsendelse af en anmodning ændrer ingen dato, status, adgang eller betaling automatisk.

Pejlo opretter anmodningstabellen automatisk i den eksisterende D1-database. Kundens egen visning og admin-køen bruger Pejlos eksisterende login og kræver ingen ny secret. Redigering af kunder i den eksisterende kundeliste følger opsætningen fra 0.8.29 og 0.8.30.
