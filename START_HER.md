0.8.69 tilføjer trykbare forklaringer til profilens statusikoner. Upload oven på 0.8.68 med samme mapper og lad det normale Cloudflare-build køre. Ingen ny serveropsætning eller nye Firebase-/Cloudflare-indstillinger.

0.8.68 viser statusikoner i profilfeltet. Upload oven på 0.8.67 med samme mapper og lad Cloudflare bygge som normalt. Ingen serverkommandoer eller nye Firebase-/Cloudflare-indstillinger. Se [versionsnoterne](docs/version-0.8.68.md).

0.8.67 aktiverer automatisk, anslået hvile efter upload oven på 0.8.66. Den eksisterende statuslæser og nøgle genbruges. Vælg Påsat Loui under Indstillinger, og gem profilen; se [vejledningen](docs/version-0.8.67.md). Ingen nye Firebase-indstillinger eller secrets.

0.8.66 tilføjer visning af seneste dvalerapport. Upload oven på 0.8.65. Denne funktion kræver også en statuslæser på Traccar-serveren og Cloudflare Secret PEJLO_STATUS_KEYS. Følg [installationen](docs/version-0.8.66.md); appupload alene aktiverer ikke logforbindelsen.

0.8.65 giver sammenklappelige historikfelter, motions-/hvileoverblik og grafer. Upload oven på 0.8.64 med samme mapper, og genåbn appen efter det normale build. Ingen nye Firebase- eller Cloudflare-indstillinger kræves. Se [versionsnoterne](docs/version-0.8.65.md).

0.8.64 udelader opladningspunkter for dyreprofiler fra ruter og GPS-kilometer. Upload oven på 0.8.63, udgiv API og web sammen via det normale build, og genåbn appen. Ingen nye Firebase- eller Cloudflare-indstillinger kræves. Se [versionsnoterne](docs/version-0.8.64.md).

0.8.63 retter centrering på kortet ved mobil-/Wi-Fi-placering. Upload oven på 0.8.62 via den normale GitHub/Cloudflare-udgivelse. Ingen ændringer af Firebase, Cloudflare-indstillinger, bindings eller secrets kræves. Se [versionsnoterne](docs/version-0.8.63.md).

0.8.62 samler profiler i D1 og gemmer GPS-dagstal. Upload oven på 0.8.61, udgiv API og web sammen, og genåbn appen. Første login overfører gamle Firestore-profiler og gemmer en kopi i D1. Behold Firebase-projektet og de eksisterende Firestore-regler. Se [versionsnoterne](docs/version-0.8.62.md).

0.8.61 retter automatisk GPS-hentning i motionshistorikken og opdatering af profilnavnet. Upload oven på 0.8.60. Ingen nye API-indstillinger eller databaseændringer. Se [versionsnoterne](docs/version-0.8.61.md).

0.8.60 tilføjer Motion og hvile under Ture for dyreprofiler. Se [versionsnoterne](docs/version-0.8.60.md). Ingen nye nøgler eller manuelle databaseændringer kræves. Upload oven på 0.8.59 og udgiv både API og web.

0.8.59 tilføjer automatisk positionsforespørgsel. Se [versionsnoterne](docs/version-0.8.59.md). Efter upload er 15-minutterskontrol slået til for godkendte, tilknyttede trackere, herunder Loui hvis PEJLO_BATTERY_DEVICES stadig indeholder hans ID. Kontrollen kan slås fra i appen.

# Start her med Pejlo 0.8.67

0.8.58 tilføjer Hurtig Wi-Fi-opsætning til batterifunktionerne fra 0.8.57. Se [versionsnoterne](docs/version-0.8.58.md) for installation og fysisk kontrol. Ældre versionsnoter beskriver historiske forhold og kan nævne demo-server, langsommere polling og tidligere begrænsninger.

## Eksisterende installation

1. Upload de udpakkede filer til roden af driftportal-platform/Pejlo med samme mapper. Erstat kun filer med samme navn.
2. Behold Cloudflare Worker pejlo, D1-binding DB, eksisterende secrets, Cron Trigger hvert minut og MAPTILER_API_KEY under Builds.
3. Lad det normale Cloudflare-build køre. Åbn appen og kontrollér version 0.8.67 på loginvisningen. En ren dokumentationsupload ændrer ikke appens version eller funktioner.
4. Aktivér mobilplacering for din egen bruger i Systemadmin → Kunder og abonnementer, hvis den skal prøves. Test derefter fysisk GPS, mobilestimat, kortfølgning og push.

Ændringspakken forudsætter 0.8.66. Upload filerne med samme mapper og udgiv både API og web. PEJLO_BATTERY_DEVICES skal stadig indeholde 080608317309. Dvalestatus kræver den separate secret og statuslæser fra vejledningen til 0.8.66. Der kræves ingen manuel databasekommando. Intervalautomatik styres fortsat af ejeren i appen.

## Før du ændrer driften

- [Teknisk oversigt og alle indstillingsnavne](docs/teknisk-drift.md)
- [Ny offentlig IP, demo-server eller anden pc](docs/ip-og-serverskift.md)
- [Brug af appen](docs/brugervejledning.md)

Ved ny offentlig IP skal DuckDNS og Google Geolocation-nøglens tilladte IP kontrolleres. Ved ny LAN-IP skal routerens portmål rettes. Ved serverskift skal trackeren sende til den nye server, og den server skal testes og aktiveres i Pejlo. Ændring af Cloudflare-fallback alene tilsidesætter ikke et aktivt adminvalg.

## Ny installation eller gendannelse

Følg den tekniske vejledning. Gendan D1 og nødvendige secrets; bevar også Firestore for endnu ikke overførte konti. En importkopi i D1 erstatter ikke en separat databasebackup; en GitHub-kopi alene gendanner ikke kundedata. Opret trackerregisteret fra apps/api/migrations ved en helt ny database. Arbejd ikke på en eksisterende database som om den var tom. Opdatér firestore.rules efter projektets gældende regler.

Tag en konsistent Traccar-backup og bevar TRACCAR_CONFIG_SECRET før flytning. Udfyld kun nøgleregistret i en privat kopi.

