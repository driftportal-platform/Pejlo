0.8.60 tilføjer Motion og hvile under Ture for dyreprofiler. Se [versionsnoterne](docs/version-0.8.60.md). Ingen nye nøgler eller manuelle databaseændringer kræves. Upload oven på 0.8.59 og udgiv både API og web.

0.8.59 tilføjer automatisk positionsforespørgsel. Se [versionsnoterne](docs/version-0.8.59.md). Efter upload er 15-minutterskontrol slået til for godkendte, tilknyttede trackere, herunder Loui hvis PEJLO_BATTERY_DEVICES stadig indeholder hans ID. Kontrollen kan slås fra i appen.

# Start her med Pejlo 0.8.60

0.8.58 tilføjer Hurtig Wi-Fi-opsætning til batterifunktionerne fra 0.8.57. Se [versionsnoterne](docs/version-0.8.58.md) for installation og fysisk kontrol. Ældre versionsnoter beskriver historiske forhold og kan nævne demo-server, langsommere polling og tidligere begrænsninger.

## Eksisterende installation

1. Upload de udpakkede filer til roden af driftportal-platform/Pejlo med samme mapper. Erstat kun filer med samme navn.
2. Behold Cloudflare Worker pejlo, D1-binding DB, eksisterende secrets, Cron Trigger hvert minut og MAPTILER_API_KEY under Builds.
3. Lad det normale Cloudflare-build køre. Åbn appen og kontrollér version 0.8.60 på loginvisningen. En ren dokumentationsupload ændrer ikke appens version eller funktioner.
4. Aktivér mobilplacering for din egen bruger i Systemadmin → Kunder og abonnementer, hvis den skal prøves. Test derefter fysisk GPS, mobilestimat, kortfølgning og push.

Ændringspakken forudsætter 0.8.59. Upload filerne med samme mapper og udgiv både API og web. PEJLO_BATTERY_DEVICES skal stadig indeholde 080608317309. Der kræves ingen ny secret eller manuel databasekommando. Automatik aktiveres bagefter af ejeren i appen.

## Før du ændrer driften

- [Teknisk oversigt og alle indstillingsnavne](docs/teknisk-drift.md)
- [Ny offentlig IP, demo-server eller anden pc](docs/ip-og-serverskift.md)
- [Brug af appen](docs/brugervejledning.md)

Ved ny offentlig IP skal DuckDNS og Google Geolocation-nøglens tilladte IP kontrolleres. Ved ny LAN-IP skal routerens portmål rettes. Ved serverskift skal trackeren sende til den nye server, og den server skal testes og aktiveres i Pejlo. Ændring af Cloudflare-fallback alene tilsidesætter ikke et aktivt adminvalg.

## Ny installation eller gendannelse

Følg den tekniske vejledning. Gendan D1 og Firestore samt nødvendige secrets; en GitHub-kopi alene gendanner ikke kundedata. Opret trackerregisteret fra apps/api/migrations ved en helt ny database. Arbejd ikke på en eksisterende database som om den var tom. Opdatér firestore.rules efter projektets gældende regler.

Tag en konsistent Traccar-backup og bevar TRACCAR_CONFIG_SECRET før flytning. Udfyld kun nøgleregistret i en privat kopi.

