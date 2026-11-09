# Money Tracker PWA & LGTM Observability Stack

Offline-first personal expense and monthly budget tracker built with **React 18 + Vite PWA + Tailwind CSS v4**, backed by **Python 3.11 + FastAPI + SQLite (WAL mode)**, defaulted to **INR (`₹`)**, and instrumented end-to-end with **OpenTelemetry + Grafana LGTM** (`Loki`, `Grafana`, `Tempo`, `Prometheus`).

> [!TIP]
> **Full Documentation Available in Two Formats:**
> - **Read on GitHub (Markdown + Mermaid):** [`docs/README.md`](./docs/README.md)
> - **Interactive Website (GitHub Pages):** **https://anuragdchowdhury.github.io/expense-tracker-PWA-LGTM-stack/**

---

## Documentation Guide

| Section | GitHub Markdown | GitHub Pages Website |
| :--- | :--- | :--- |
| **Docs Hub** | [`docs/README.md`](./docs/README.md) | [Site Home](https://anuragdchowdhury.github.io/expense-tracker-PWA-LGTM-stack/) |
| **Tech Stack & Repo Layout** | [`docs/tech-stack.md`](./docs/tech-stack.md) | [`docs/index.html`](./docs/index.html) |
| **High-Level Design (HLD)** | [`docs/hld.md`](./docs/hld.md) | [`docs/hld.html`](./docs/hld.html) |
| **Low-Level Design (LLD)** | [`docs/lld.md`](./docs/lld.md) | [`docs/lld.html`](./docs/lld.html) |
| **Observability & LGTM Stack** | [`docs/observability.md`](./docs/observability.md) | [`docs/observability.html`](./docs/observability.html) |

---

## Architecture Overview

- **Frontend PWA (`frontend/`):** React 18 + Recharts dashboard, offline snapshot caching & pending mutation queue (`client_id`) in IndexedDB via [`offlineStore.js`](./frontend/src/utils/offlineStore.js), Workbox service worker (`sw.js`), `Temporal` calendar date handling (`temporal.js`), and `en-IN` INR formatting (`currency.js`).
- **Nginx Gateway (`nginx/default.conf`):** Serves compiled static assets on port `80`, prevents stale caching of `index.html`, `sw.js`, and `manifest.json`, and proxies `/api/*` to the FastAPI container.
- **FastAPI + SQLite (`backend/`):** REST API storing users, monthly budgets, and expenses in SQLite WAL mode with idempotent `client_id` deduplication.
- **LGTM Observability (`observability/`):** Backend emits OTLP traces (`FastAPIInstrumentor` + `SQLite3Instrumentor`), custom business counters/histograms, and trace-correlated structured logs via `otel-collector` to **Tempo v3**, **Prometheus v3**, and **Loki v3**, surfaced in **Grafana** (`money-tracker-lgtm`).

---

## Quick Start

```zsh
# Start all 7 containers (frontend, backend, otel-collector, prometheus, loki, tempo, grafana)
docker compose up --build -d

# Verify running containers & API health
docker compose ps
curl -fsS http://localhost:80/api/health
curl -fsS "http://localhost:80/api/dashboard?year=2026&month=11"

# Stop containers cleanly (preserves persistent data volumes)
docker compose down
```

### Exposed Services

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Money Tracker PWA & API** | `http://localhost:80` | Installable PWA; API mounted at `/api/*` |
| **Grafana UI** | `http://localhost:3000` | Credentials: `admin` / `admin` (anonymous Admin enabled locally) |

---

## Currency Configuration (`INR` Default)

- **Backend:** Set via `CURRENCY=INR` in [`.env`](./.env) and passed in [`docker-compose.yml`](./docker-compose.yml). Returned in `GET /api/dashboard` (`"currency": "INR"`) and attached as the unit for `money_tracker_expense_amount` in [`backend/main.py`](./backend/main.py).
- **Frontend:** Formats amounts in Indian Rupees (`₹`, `en-IN` grouping) via [`frontend/src/utils/currency.js`](./frontend/src/utils/currency.js), with an optional Display Currency selector (`INR`, `USD`, `EUR`, `GBP`) in Settings.

---

## Running Tests & Local Builds

```zsh
# Backend API & OpenTelemetry unit tests
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt httpx
(cd backend && ../.venv/bin/python -m unittest discover -s tests -v)

# Frontend production & PWA service worker build
(cd frontend && npm install && npm run build)
```

---

## Hosting Documentation on GitHub Pages

1. Push all changes (including [`docs/`](./docs/README.md) and [`docs/.nojekyll`](./docs/.nojekyll)) to `main`.
2. Open repository **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Select branch **`main`** and folder **`/docs`**, then click **Save**.
