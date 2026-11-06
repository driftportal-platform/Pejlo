# Pejlo 0.8.8 – bedre plads og rulning på mobilen

- Informationskortet ligger nu under kortet uden negativt overlap.
- Siden har ekstra bundplads, så indhold kan rulles fri af den faste menu og telefonens sikre bundområde.
- Mobilkortet fylder mindre i højden, og der er en fri stribe i højre side til at rulle siden med fingeren.
- En smal rulleskyder til højre kan trækkes op og ned. Den virker også med piletaster, Page Up/Down, Home og End.
- Knappen »Til toppen« vises, når man er et stykke nede. Kontrollerne skjules ved login og åbne dialoger.
- Historikkens datoer holder sig inden for hver sin kolonne. På meget smalle skærme vises de under hinanden. Dato- og tidsfelter har begrænset bredde også i Safari.

## Opdatering
Erstat projektfilerne med denne pakkes indhold som ved tidligere versioner. Ingen nye nøgler, databaseændringer eller Cloudflare-indstillinger kræves.

## Kontrol
97 lokale automatiske tests bestået, herunder rulleskyderens træk, tastatur, login/dialog-skjulning og reduceret animation. Backend er uændret fra 0.8.7. Layoutet er ikke visuelt testet på en fysisk iPhone.

Efter opdatering: luk og genåbn PWA'en. Kontrollér Kort med flere oplysninger udfoldet, Ture med begge datoer samt rulning fra toppen til nederste knap. Rul langs højre kant eller træk i skyderen; bevægelse inde på kortet flytter fortsat kortet. Prøv »Til toppen«. Kontrollér også områdeeditoren og telefonens landskabsvisning.
