# Pejlo 0.8.72 – ét statusfelt ved profilnavnet

Upload ændringspakken oven på 0.8.71 via GitHub med de samme mapper. Lad det normale Cloudflare-build udgive appen, og genåbn Pejlo. Ingen serverkommandoer, secrets eller Firebase-indstillinger skal ændres.

Ved siden af profilnavnet står nu ét farvet statusfelt. Det skifter automatisk ved nye data og når målinger bliver gamle:

| Visning | Betydning |
| --- | --- |
| Aktiv | To brugbare GPS-målinger viser bevægelse. |
| Mulig hvile | Det eksisterende hvileestimat har tilstrækkelige målinger. Ikke målt søvn. |
| Dvale | En frisk dvalerapport er modtaget, uden en nyere positionsrapport. Gælder trackeren, ikke dyrets søvn. |
| Oplader | Frisk rapporteret opladning. |
| Online | Frisk kontakt, men aktivitet og dvale kan ikke fastslås. |
| Offline | Traccar melder trackeren offline. |
| Afventer / Ukendt | Der mangler aktuelle data eller en kendt forbindelsesstatus. |
| Ikke tilknyttet | Profilen har ingen tracker. |

Offline har forrang, derefter opladning og frisk dvalerapport, så aktivitet/hvile og til sidst kontakt. Gamle dvalerapporter gør ikke feltet til Dvale. Data fra en anden profil eller serverens eksempeldata kan ikke give en aktuel trackerstatus. Navnet og profilvælgeren fungerer som før, og signalikonerne nedenunder bevares med deres forklaringer.

Det nye felt bruger eksisterende data og sender ingen nye trackerkommandoer. Hvileberegning og historik er uændret.

Validering: 347 tests bestået, 0 fejl. Statusprioritet, gamle data, profilskift, bevægelse, mulig hvile og udskiftning af statusfeltets tekst er kontrolleret.
