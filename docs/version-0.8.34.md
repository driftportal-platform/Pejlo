# Pejlo 0.8.34

## Test af betaling

Start med en Stripe-sandbox. Opret fire tilbagevendende Stripe-priser i DKK med moms inkluderet.

| Cloudflare-variabel | Beløb | Periode |
| --- | --- | --- |
| STRIPE_PRICE_MONTHLY_FIRST | 49 kr. | Måned |
| STRIPE_PRICE_MONTHLY_EXTRA | 29 kr. | Måned |
| STRIPE_PRICE_ANNUAL_FIRST | 449 kr. | År |
| STRIPE_PRICE_ANNUAL_EXTRA | 269 kr. | År |

Sæt de fire `price_…`-ID'er som Cloudflare-variabler. Sæt `STRIPE_SECRET_KEY` og `STRIPE_WEBHOOK_SECRET` som Cloudflare Secrets. Brug nøgler fra samme Stripe-miljø som priserne.

Opret en kundeportal i Stripe med opsigelse ved periodens udløb. Lad skift af abonnement og antal være slået fra, så første og ekstra tracker fortsat afregnes efter Pejlos prisliste. Sæt portalens `bpc_…`-ID i `STRIPE_PORTAL_CONFIGURATION`. Opret webhook på Pejlos domæne under `/api/stripe/webhook` og abonnér på:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Log ind med en særskilt testkonto uden aktiv manuel aftale. Køb to trackere med årsbetaling via **Mit abonnement** og tjek, at Checkout viser 718 kr. for abonnementet. Tjek Stripe-status i Pejlo og Systemadmin efter webhook. Test derefter opsigelse ved periodens udløb i kundeportalen. Hardware, SIM og fragt ligger uden for Checkout i denne version. Stripe-betalingen knytter ikke en fysisk tracker til kontoen.

Kunder med aktive manuelle aftaler bruger stadig de eksisterende anmodninger. En aftale, som styres i Stripe, skal ændres i Stripe. At spærre login stopper ikke en Stripe-aftale.

## Find i 10 minutter og lyd

`PEJLO_TRACKER_ACTIONS` er en Cloudflare Secret med et JSON-objekt, hvor nøglerne er tracker-ID'er. Et tracker-ID kan have felterne `find` og `sound`. Hvert felt skal indeholde den fulde, afprøvede HEX-kommando til netop den tracker og dens firmware. Undlad feltet, indtil kommandoen er verificeret.

`find` skal udløbe i selve enheden efter 10 minutter. Pejlo viser en nedtælling og spørger Traccar om nye positioner cirka hvert tiende sekund i den aktive søgning. `sound` skal afspille et kort lydsignal med automatisk stop. Test med trackeren taget af dyret. Kun ejeren kan sende kommandoerne, og det kræver en online tracker samt en custom-kommando understøttet af Traccar. Q8 leveres uden forudkonfigurerede kommandoer i Pejlo.

D1-tabeller oprettes ved brug. Pakken indeholder ingen Stripe-nøgler eller trackerkommandoer.
