# Arkitektur og næste trin · 0.3

## Implementeret

Modulopdeling af profiler, storage, kortlag, mobilplacering, ikoner og geometri.
Navigation: Kort, Ture, Indstillinger og en separat søgevisning.
Datakilden er eksplicit demoFor(profile); ingen serverforespørgsler om trackere.
Lokal lagring er ikke login, rettighedskontrol eller bevis for tracker-ejerskab.
HTML i brugervalgte navne vises som tekst, også i kortmarkørens tooltip.

## Mobil søgning

watchPosition starter kun via brugerens knap. ClearWatch ved sideskift, pagehide og skjult app.
Kompas via webkitCompassHeading med kvalitetskontrol, alternativt absolut orientering.
Ingen antagelse om, at almindelig alpha er en nordreference. Kompas bortfalder efter 10 sekunder uden hændelser.
Mobilposition ældre end 20 sekunder markeres; pil dæmpes og autofølg standses.
Autozoom tilpasser begge punkter og begrænses af mobilens positionsusikkerhed.
Nærhed inden for GPS-usikkerhed markeres som usikker, ikke 'fundet'.
Manuel panorering slår autofølg fra; afkrydsningsfeltet kan genaktivere det.

## Kortlag

MapTiler TileJSON for streets-v4, satellite og outdoor-v2. Kræver brugerens kortnøgle.
Tidligere lag bevares ved metadatafejl. Flisefejl vises som besked.
Ingen massehentning eller offline-cache af kort. Attribution vises på geografiske lag.
Kortforespørgsler deler det viste kortområde med kortudbyderen.
Skematisk lokal SVG er et eksempel og må ikke forveksles med reelle veje.

## Næste trin

1. Firebase Authentication og kundekonti med ejer og medlem.
2. Backend kontrollerer token, medlemskab og adgang pr. tracker/profil.
3. Traccar-konto/adgang beskyttes som serverhemmelighed. Kald aldrig Traccar med en indbygget adgangskode fra klienten.
4. Dataadapter leverer gyldig seneste position, tidspunkt, batteri og historik per tilladt tracker.
5. Verificér tracker-ejerskab ved tilknytning. Enheds-ID alene er ikke ejerskab.
6. Indfør delte hjemmepunkter, invitationer og synkronisering, derefter beskeder.

Før salg: kontrolleret Traccar-drift, adskilte kunder, sletning/eksport, licenser, backup og driftspriser.
