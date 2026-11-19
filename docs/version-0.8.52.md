# Pejlo 0.8.52

Under **Indstillinger → Tracker → Mobilplacering på din konto** kan brugeren nu se, om administratoren har slået adgangen til eller fra. Brugeren kan ikke ændre tilladelsen. Status er tilgængelig også uden en tilknyttet tracker.

Tryk **Opdatér kontostatus** for at hente den igen. Med en tilknyttet tracker opdateres tilladelsen også sammen med de almindelige trackerdata. En forbindelsesfejl vises som ukendt eller senest kendt status; den fremstilles ikke som et fravalg. Et kontoskift rydder den tidligere kontos status.

Tilladelse på kontoen betyder, at Pejlo må vise et egnet estimat. Det betyder ikke, at et Google-opslag er lykkedes, eller at den aktuelle position kommer fra mobilnettet. GPS har førsteprioritet; et vist mobilestimat mærkes med usikkerhedscirkel og teksten Omtrentlig mobil-/Wi-Fi-placering på kortet. Traccars Google-opslag styres fortsat separat.

Upload ZIP-filens indhold til samme mapper i repositoryt. Pakken indeholder kun ændringer oven på 0.8.51 og kræver ingen nye secrets eller manuelle databaseændringer. Cloudflare bygger som hidtil. Kontrollér version 0.8.52 efter udgivelsen.

## Lukket låg på serverens bærbare pc

Traccar og Caddy fortsætter kun, hvis Windows forbliver vågen. Åbn Win + R → powercfg.cpl → Vælg, hvad der skal ske, når du lukker låget. Vælg Foretag dig intet ved Tilsluttet strøm. Kontrollér også, at automatisk slumretilstand på strøm er slået fra. Skærmen må gerne slukke. Test efter låglukning fra telefonens mobildata, at trackeren stadig leverer nye positioner.
