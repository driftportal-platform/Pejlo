# Pejlo 0.8.35

Standardpriser og besparelser vises for 1, 12 og 24 måneder i Systemadmin og Mit abonnement. I Systemadmin kan en administrator vælge 24 måneder, udfylde den aftalte udløbsdato og gemme prisen. Eksisterende aftaler ændres kun, hvis administratoren gemmer en ny aftalepris eller periode.

| Periode | Første tracker | Hver ekstra tracker |
| --- | --- | --- |
| 1 måned | 49 kr. | 29 kr. |
| 12 måneder | 449 kr. | 269 kr. |
| 24 måneder | 799 kr. | 479 kr. |

Besparelsen regnes mod månedsbetaling over den samme periode. Tracker og SIM betales særskilt.

## Test af Stripe med 24 måneder

De eksisterende Stripe-priser og opsætningen fra 0.8.34 bruges fortsat. I Stripe-testmiljøet kan 24 måneder prøves ved at oprette disse to ekstra priser med moms inkluderet, valuta DKK, interval `year` og `interval_count=2`.

| Cloudflare-variabel | Pris |
| --- | --- |
| STRIPE_PRICE_BIENNIAL_FIRST | 799 kr. |
| STRIPE_PRICE_BIENNIAL_EXTRA | 479 kr. |

Sæt variablerne til de respektive Stripe-pris-ID'er. Den automatiske betaling for 24 måneder er begrænset til testmiljøet. Før livebetaling åbnes, skal opsigelse før periodens udløb og tilbagebetaling af den resterende periode være håndteret. Se [forbrugeraftaleloven §§ 28–29](https://www.retsinformation.dk/api/pdf/232299).
