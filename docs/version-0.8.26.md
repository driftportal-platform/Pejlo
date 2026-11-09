# Pejlo 0.8.26

Under **Indstillinger → Tracker → Administrator: driftsstatus** viser **Hent forbrug** dagens målinger og andelen af gratisgrænserne. Cloudflare viser Workers-forespørgsler og D1-rækker for hele kontoen fra midnat UTC. Firestore viser dokumentlæsninger og -skrivninger for Pejlos standarddatabase fra midnat i Californien. Firestore-tallene er aktivitetsmålinger og kan afvige fra fakturerede operationer.

Sæt følgende værdier på Pejlo Workeren under **Settings → Variables and secrets**:

| Navn | Type | Værdi |
|---|---|---|
| `CF_ACCOUNT_ID` | Variabel | Cloudflare-kontoens ID |
| `CF_ANALYTICS_TOKEN` | Secret | Cloudflare API-token med **Account → Account Analytics → Read**, afgrænset til kontoen |
| `GCP_MONITORING_SERVICE_ACCOUNT` | Secret | Hele JSON-nøglefilen til en særskilt tjenestekonto med **Monitoring Viewer** (`roles/monitoring.viewer`) på Pejlos Firebase-projekt. Aktivér Cloud Monitoring API i samme projekt. |

Cloudflare og Firebase kan konfigureres hver for sig. Hvis en kilde mangler adgang eller svarer med fejl, viser Pejlo status for den kilde. Værdierne hentes ved tryk på knappen. Tælleren kræver ingen databaseændring.
