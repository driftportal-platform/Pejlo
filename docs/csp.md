# Sikkerhedspolitik (CSP) – 0.7.5

Pejlo sender nu `Content-Security-Policy-Report-Only` (se `apps/web/_headers`). I denne tilstand **blokeres intet**; browseren melder blot, hvad en streng politik ville have blokeret. `X-Frame-Options: DENY` er derimod aktiv: Pejlo kan ikke lægges i en iframe på andre sider.

## Hvad politikken tillader

- Scripts: kun egne filer og `https://www.gstatic.com` (Firebase). Ingen inline-scripts og ingen `eval`.
- Netværkskald: Pejlos eget API, Firebase (`identitytoolkit`, `securetoken`, `firestore`, `www.googleapis.com`) og MapTiler.
- Billeder: egne, `data:`/`blob:` og MapTiler-fliser. Skrifttyper: `fonts.googleapis.com` / `fonts.gstatic.com` (se nedenfor).
- Ingen `object`/`base`-tags, formularer kun til egen adresse.

## Sådan afprøver I den (ca. en uge)

1. Deploy 0.7.5 og brug appen på jeres telefoner: login, opret konto/bekræftelsesmail, kort, historik, push, invitation og tracker-tilknytning.
2. Hvis browseren ville have blokeret noget, vises en kort besked i appen: «Sikkerhedspolitik (test): …» med den berørte regel og adresse (kun de første fem forskellige). På computer kan I se alle i browserens konsol (Console).
3. Tilføj de adresser, der viser sig at være nødvendige, i `_headers`.
4. Når der ikke kommer flere meldinger, skift navnet fra `Content-Security-Policy-Report-Only` til `Content-Security-Policy` og tilføj `; frame-ancestors 'none'`. Afprøv igen. Rul tilbage ved at sætte `-Report-Only` på igen.

## Kendt svaghed

- `style-src` indeholder `'unsafe-inline'`, fordi appen har inline `style`-attributter. Scripts er det vigtigste at låse, og de er låst.
- Skrifttyperne hentes fra Google Fonts. Det sender besøgendes IP-adresse til Google. Vil I undgå det (relevant for persondata), kan skrifttyperne lægges i `src/assets` og `@import` i `app.css` fjernes; så kan de to Google-adresser udgå af politikken.
