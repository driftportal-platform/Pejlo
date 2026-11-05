# Nyt i 0.6.1
Navngiv og gem op til 20 cirkler/polygoner per profil. Vælg et gemt område for at skifte; overvågningens til/fra-valg bevares. Nyt område sætter den tidligere overvågning på pause. Slet det valgte område afbryder dets overvågning; andre gemte områder bevares. Ét aktivt serverområde per tracker. Områderne gemmes på kontoen; browserrydning sletter dem ikke. Eksisterende hjemmeområde indlæses som Hjemme.

Margenen kan sættes til 0–30 meter; standard er 5 meter. To forskellige friske positioner kræves stadig. Margenen er ikke en GPS-nøjagtighedsangivelse. 0 m giver større risiko for skift ved udsving omkring kanten. På serveren ændres eksisterende gemte områder først, når Gem hjemmeområde bruges igen. Ingen nye Cloudflare-værdier eller nøgler kræves.

# Pejlo 0.6.0 – hjemmeområder og push

## Brugeren
Indstillinger → Hjemmeområde → vælg Cirkel eller Tegn med punkter.
- Cirkel: vælg hjemmet på kortet, brug mobilens placering som forslag eller indtast koordinater; vælg radius 20–5000 meter.
- Punkter: tryk Tegn område på kortet. Tryk langs grænsen i rækkefølge (3–50 punkter). Fortryd fjerner det sidste punkt; Annuller beholder det tidligere område. Tryk Brug dette område, slå Overvåg hjemmeområdet til, og Gem hjemmeområde. Krydsende kanter afvises; alle punkter skal være indenfor 20 km af første punkt.
- Notifikationer: tryk Aktivér beskeder på denne enhed og giv tilladelse. Tryk Send testbesked. På iPhone skal Pejlo først være føjet til hjemmeskærmen og åbnet derfra.

Brugere behøver ikke Traccar-login, egne API-nøgler eller manuel serveropsætning. Én tracker har ét aktivt serverområde; seneste gemte område for samme tracker erstatter det tidligere. Profilen gemmes privat på kontoen; serverområdet kontrolleres mod trackerens ejer. Området skal gemmes igen ved ændring fra en anden enhed. Sletning af profilen eller fjernelse af dens tracker slår dens aktive område fra.

## Engangsopsætning for administrator
1. Upload hele ZIP-indholdet i GitHub som tidligere, uden node_modules eller dist. Cloudflare bygger npm run build og deployer npx wrangler deploy. npm install henter den låste @block65/webcrypto-web-push 2.0.0.
2. Kør `node scripts/generate-push-keys.mjs` på din egen computer. Scriptet viser tre værdier. Gem den private nøgle sikkert; læg aldrig output i GitHub.
3. Cloudflare → pejlo → Settings → Runtime variables and secrets: tilføj VAPID_PUBLIC_KEY som Variable, VAPID_PRIVATE_KEY som Secret, og VAPID_SUBJECT som Variable. Subject er mailto:Driftportal.platform@gmail.com. Behold TRACCAR_TOKEN, TRACCAR_ADMIN_UID og D1-binding DB. Build-variabler kan ikke erstatte runtime-secrets.
4. Gem/deploy indstillingerne. wrangler.jsonc indeholder Cron hvert minut. Kontrollér at Trigger Events viser tidsplanen efter GitHub-deploy; propagering kan tage op til 15 minutter.
5. Ingen nye Firestore-regler eller manuel SQL. De tre pejlo-tabeller oprettes automatisk i D1 ved første brug.
6. Åbn appen fra hjemmeskærmen, gem et område, aktivér beskeder og send testbesked. Først efter en modtaget besked er telefonlevering bekræftet.

Nøgleskift kræver at browserens gamle pushabonnement slås fra og aktiveres igen. Log ud afmelder denne enheds push. Op til fem abonnementer per konto. Ved manglende serveropsætning vises en fejl.

## Adfærd og begrænsninger
To forskellige nye gyldige GPS-fixes skal bekræfte passagen, med den valgte margen på begge sider. Punkter ældre end 5 minutter, ugyldige GPS-fixes, eksempler og forbindelsesfejl udløser ikke alarm. En første position udenfor etablerer starttilstand uden udgangsalarm. Bufferen er ikke et løfte om GPS-nøjagtighed.

Åben app viser status og tekstbeskeder for den valgte profil. Serveren kontrollerer gemte aktive områder også når appen er lukket. Pilotgrænse: 8 trackere per minut i rotation; flere øger forsinkelsen. Cron ser seneste position; korte ture mellem kontroller kan overses. Traccars demo3-server og et gyldigt TRACCAR_TOKEN er nødvendige.

Web Push sendes krypteret med aes128gcm og VAPID. Låseskærmen viser generisk udgang/tilbagekomst uden navn, koordinater eller ID. Levering forsøges op til tre gange inden for fem minutter. Beskeder kan gå tabt eller dubleres ved genforsøg; samme notifikationstag erstatter den tidligere. Udløbne abonnementer fjernes ved 404/410. Levering afhænger af internet, browser og telefonens indstillinger.

## Kontrol
41 automatiske tests dækker cirkel/polygon, randafstand, ugyldige polygoner, forskellige fixes, gamle punkter, ejerskifte, abonnementers endpoints og krypteret payload. Worker-pakken kontrolleret med wrangler deploy --dry-run. Browserkontrol med syntetiske konto- og trackerdata; rigtig iPhone-push og Cloudflare-cron skal verificeres efter deploy.
