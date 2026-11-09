# Tech Stack & Repository Overview

> Reading on GitHub Pages? Open [`index.html`](./index.html) • Back to [Docs Home](./README.md)

## 1. Project Overview

Money Tracker is a self-hosted personal expense and monthly budget ledger packaged as a 7-container `docker compose` deployment. The Progressive Web App works offline using Workbox asset precaching + an IndexedDB write queue and defaults to **Indian Rupee (`INR` / `₹`)** formatting (`en-IN` locale), while allowing display switching to `USD`, `EUR`, or `GBP` inside Settings.

---

## 2. Frontend Tech Stack

Defined in [`frontend/package.json`](../frontend/package.json) and [`frontend/vite.config.js`](../frontend/vite.config.js):

| Technology | Version / Package | Role in Application |
| :--- | :--- | :--- |
| **React & Vite** | `react@^18.3.1`, `vite@^6.1.0` | Component rendering, period navigation, optimized production bundles with content-hashed assets |
| **Vite Plugin PWA** | `vite-plugin-pwa@^0.21.1` | Workbox service worker (`sw.js`) precaching JS/CSS/HTML/SVG/PNG/JSON with `autoUpdate` and `/api/` exclusion |
| **Tailwind CSS v4** | `tailwindcss@^4.0.9`, `@tailwindcss/vite` | Mobile-first layout, CSS variable light/dark theming, native `<dialog>` & `<progress>` styling |
| **Recharts & Lucide** | `recharts@^2.15.1`, `lucide-react@^0.475.0` | Category spending donut chart, Mon–Sun weekly / monthly trend line chart, and UI icons |
| **Temporal API** | Native + `temporal-polyfill@^0.3.0` | Conditional polyfill for `Temporal.PlainDate` / `PlainYearMonth` avoiding UTC midnight calendar drift |
| **IndexedDB & Intl** | `money-tracker-pwa` DB + `Intl.NumberFormat` | Offline snapshots, pending write queue, and `en-IN` currency formatting in [`currency.js`](../frontend/src/utils/currency.js) |

---

## 3. Backend Tech Stack

Defined in [`backend/requirements.txt`](../backend/requirements.txt) and built with `python:3.11-slim` ([`backend/Dockerfile`](../backend/Dockerfile)):

- **FastAPI + Uvicorn:** Typed REST endpoints under `/api` with automatic OpenAPI docs, Pydantic v2 validation, and lifespan teardown flushing telemetry providers.
- **SQLAlchemy 2 + SQLite (WAL mode):** Declarative models (`User`, `Budget`, `Expense`) with indexed `YYYY-MM-DD` dates, unique `client_id` deduplication, `PRAGMA journal_mode=WAL;`, and `PRAGMA foreign_keys=ON;`.
- **OpenTelemetry Python SDK:** Automatic `FastAPIInstrumentor`, `SQLite3Instrumentor`, `LoggingInstrumentor`, plus custom counters/histograms exporting OTLP/HTTP to `otel-collector:4318`.

---

## 4. Observability & Proxy Infrastructure

Configured in [`docker-compose.yml`](../docker-compose.yml) and [`observability/`](../observability):

| Component | Image / Version | Ports & Storage |
| :--- | :--- | :--- |
| **Nginx Proxy** | `nginx:1.27-alpine` | Host port `80` → serves compiled SPA, enforces PWA `no-cache` on `sw.js`/`index.html`, proxies `/api/` to `backend:8000` |
| **OTel Collector** | `otel/opentelemetry-collector-contrib:latest` (v0.165+) | Internal `4317` (gRPC), `4318` (HTTP), `8888` (Prometheus self-metrics); `memory_limiter` + `batch` |
| **Prometheus** | `prom/prometheus:latest` (v3) | Internal `9090`; enabled `--web.enable-remote-write-receiver` and `--web.enable-otlp-receiver` |
| **Loki** | `grafana/loki:latest` (v3) | Internal `3100`; native OTLP log endpoint (`/otlp`) with TSDB store + `v13` schema |
| **Tempo** | `grafana/tempo:latest` (v3) | Internal `3200` / `4317`; monolithic local block + WAL trace storage |
| **Grafana** | `grafana/grafana:latest` | Host port `3000`; auto-provisioned datasources & **Money Tracker - LGTM Observability** dashboard |

---

## 5. Repository Structure

```text
expense-tracker-PWA-LGTM-stack/
├── .env                          # Runtime ports, CURRENCY=INR, OTel & Grafana credentials
├── docker-compose.yml            # 7-service topology, volumes, and bridge network
├── README.md                     # Repository home & quick start
├── backend/
│   ├── Dockerfile                # python:3.11-slim + uvicorn server
│   ├── requirements.txt          # FastAPI, SQLAlchemy, OTel SDK & instrumentors
│   ├── models.py                 # User, Budget, Expense models + SQLite WAL pragmas
│   ├── main.py                   # API routes, OTel setup, aggregation logic
│   └── tests/test_api.py         # Unit & API integration tests (stdlib unittest)
├── frontend/
│   ├── Dockerfile                # Multi-stage Node 22 build -> nginx:1.27-alpine
│   ├── vite.config.js            # VitePWA manifest + Workbox precaching config
│   └── src/
│       ├── api.js                # Online/offline facade & syncPendingChanges loop
│       ├── App.jsx               # Root state, currency selector & online listeners
│       ├── components/           # Dashboard, AddExpenseDialog, BottomNav, Settings
│       └── utils/                # currency.js (INR), temporal.js, offlineStore.js, validation.js
├── nginx/default.conf            # PWA no-cache rules, immutable /assets/, /api/ proxy
├── observability/
│   ├── otel-collector-config.yaml
│   ├── prometheus.yaml
│   ├── loki-config.yaml
│   ├── tempo.yaml
│   └── grafana/provisioning/     # Pre-wired datasources + LGTM dashboard JSON
└── docs/
    ├── .nojekyll                 # Ensures GitHub Pages serves static HTML/CSS/JS verbatim
    ├── README.md                 # Markdown documentation hub (rendered by GitHub)
    ├── tech-stack.md             # Tech stack & repository overview (this page)
    ├── hld.md                    # High-Level Design (Markdown + Mermaid)
    ├── lld.md                    # Low-Level Design (Markdown + Mermaid)
    ├── observability.md          # Observability & LGTM setup (Markdown + Mermaid)
    ├── index.html                # GitHub Pages website home
    ├── hld.html                  # GitHub Pages HLD view
    ├── lld.html                  # GitHub Pages LLD view
    ├── observability.html        # GitHub Pages Observability view
    └── assets/                   # Website styles, interactive scripts & SVG favicon
```

---

## 6. Hosting Documentation on GitHub Pages

The `docs/` directory includes both native Markdown files (`docs/*.md`) for reading directly inside GitHub and a standalone responsive documentation website (`docs/*.html` with `docs/.nojekyll`):

1. Open **Settings → Pages** in your GitHub repository.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/docs`**, then click **Save**.

Next: [High-Level Design (HLD) →](./hld.md)

