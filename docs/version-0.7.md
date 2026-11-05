# Pejlo 0.7.0 – beskeder, familiedeling og historik

Denne pakke er en komplet opdatering af 0.6.1. Upload hele indholdet til det eksisterende GitHub-repository, som hidtil. Behold eksisterende Cloudflare build- og deploykommandoer.

## Cloudflare

- Behold D1-bindingen `DB` → `pejlo-trackers`.
- Behold `TRACCAR_URL`, `TRACCAR_TOKEN`, `TRACCAR_ADMIN_UID` og de tre eksisterende VAPID-indstillinger. Behold `MAPTILER_API_KEY` i buildmiljøet.
- Der kræves ingen nye nøgler og ingen ændringer i Firebase-reglerne.
- De nye D1-tabeller oprettes automatisk af Worker-koden ved første brug. Gamle profiler og gemte områder flyttes automatisk til en fælles serverprofil, når ejeren åbner appen. Eksisterende private profiler forbliver i Firestore som kontolagring; serverprofilen er autoritativ for en tilknyttet tracker.
- Behold cron `* * * * *`. Alarmkontrollen sker på serveren; telefonen behøver ikke holde appen åben.
- Vent på vellykket deployment, og luk/genåbn PWA'en. Det kan være nødvendigt at genindlæse siden.

## 1. Mine beskeder

Åbn Indstillinger og vælg profilen. Under **Mine beskeder** vælger du uafhængigt:

- Forlader området / tilbage i området.
- Lavt batteri med grænse på 5–50 %.
- Manglende nye GPS-positioner efter 5–1.440 minutter.
- Stilleperiode i dansk tid. Den må gå over midnat. Ens start/slut betyder ingen stilleperiode.

Tryk **Gem mine beskeder**. Aktivér push og send en testbesked på hver telefon. Hver bruger har egne alarmvalg, som gælder alle brugerens tilmeldte enheder. Geofence-beskeder kræver aktiveret områdeovervågning; de to andre alarmtyper fungerer uden geofence.

Beskeder, der opstår under stilleperioden, springes over og genudsendes ikke bagefter. Lavt batteri giver en besked ved overskridelse; en ny batterialarm kræver, at batteriet først kommer mindst 5 procentpoint over grænsen igen. Manglende GPS giver én besked per periode uden friske positioner; nye gyldige positioner nulstiller tilstanden. En gammel position er aldrig bevis på en ny geofence-passage.

## 2. Familiedeling

1. Ejeren åbner appen, vælger fx Loui og går til **Familiedeling**.
2. Indtast Louises e-mail og tryk **Opret invitationskode**.
3. Giv selv koden til Louise. Appen sender ikke en invitationsmail.
4. Louise opretter sin egen Pejlo-konto med netop den e-mail og bekræfter mailen.
5. Hun indtaster koden under **Modtaget en invitation?**. Dette felt er også tilgængeligt før hendes første profil er oprettet.
6. Vælg den delte profil øverst. Louise vælger selv sine alarmindstillinger og aktiverer push på sin telefon.

Koden er engangsbrug, bundet til den bekræftede e-mail og gyldig i 7 dage. Ubrugte invitationer kan annulleres. Kun ejeren kan invitere og fjerne medlemmer. Alle medlemmer kan redigere profilnavn, type, hjemmeområde, gemte områder og fælles overvågning. Der er én fælles aktiv geofence per tracker. Adgang til både seneste position og historik kontrolleres på serveren ved hvert kald.

Delte ændringer hentes ved åbning og derefter ca. hvert minut, når appen er synlig. Mens man redigerer en formular, sættes denne opdatering på pause. Samtidige gemninger beskyttes med versionskontrol; ved konflikt hentes den nyeste profil, og brugeren må prøve igen. Fjernet adgang gælder efterfølgende serverkald; oplysninger, der allerede er vist, kan ikke trækkes tilbage fra en bruger.

**Fjern profil** som ejer fjerner også delingen og stopper profilens beskeder. Den sletter ikke trackerregistreringen eller data hos Traccar. En delt bruger kan i stedet forlade profilen.

## 3. Historik

Under **Ture** findes I dag, I går og Fra/Til (højst 31 dage). Datoer og klokkeslæt bruger `Europe/Copenhagen`, også over sommer-/vintertid. Dagens overblik følger nu dansk midnat frem for UTC.

- Historikken vises på sit eget kort med ruteskyder og afspil/pause.
- Pauser over 10 minutter vises som huller; kortet tegner ingen forbindelseslinje hen over dem, og afspilningen springer dem over.
- Afstand er et skøn. Små bevægelser under 5 m tælles ikke; umulige spring over 70 m/s frasorteres. Grænsen er bred, fordi appen også bruges til biler. Dette er ikke en fuldstændig GPS-driftmodel.
- Anslåede ud-/indpassager beregnes med det **nuværende** område. Området kan have været anderledes på den valgte dato, så dette er ikke et historisk alarmarkiv.
- Maks. 10.000 punkter per hentning. Hvis rapporten er længere, oplyses begrænsningen. Vælg en kortere periode for flere detaljer.
- Traccars testserver bestemmer, hvor langt tilbage data findes. Appen lover ikke en bestemt opbevaringstid.

## Kontrol efter upload

Geofence-gåtesten kan vente, som aftalt. Det øvrige kan kontrolleres nu:

1. Gem egne alarmvalg, genåbn appen, og kontrollér at de bliver bevaret.
2. Del Loui mellem to konti og kontrollér fælles profilnavn og områder. Kontrollér, at de to konti har forskellige alarmvalg.
3. Fjern den delte adgang og kontrollér, at den anden konto ikke længere kan hente position/historik. En allerede åben skærm opdateres ved næste hentning.
4. Vælg I går og en anden dato; kontrollér dansk tid mod Traccar.
5. Send en push-test på begge telefoner.

Automatiske tests dækker adgang, invitationer, tilbagekaldelse, versionskonflikter, danske døgn ved tidsomstilling, rutehuller og alarmtilstande. En simuleret DOM-gennemgang dækker ejerens og et nyt medlems formularflow. Rigtig familiedeling og nye alarmtyper på jeres telefoner er ikke live-testet her.

## Pilotgrænser

Baggrundskontrollen behandler højst 8 trackere per cron-kørsel med rotation. Konti kan have højst 5 pushenheder; deling er beregnet til en lille familie og ikke belastningstestet til mange samtidige brugere. Der kan være forsinkelse, og korte ture mellem målinger kan overses. Traccar-fejl kan forsinke både kontrol og beskeder; der sendes ikke falske geofence-beskeder på baggrund af manglende data. Pushlevering afhænger fortsat af browser, telefon og netværk.
