# 1. Project Overview & Architecture
Build an offline-first, containerized Money Tracker Progressive Web App (PWA) with full OpenTelemetry (OTel) observability. The application will run entirely locally on an Apple Silicon (ARM64) Mac via a single `docker-compose.yml` exposed on port `80`.

**Tech Stack:**
*   **Frontend:** React + Vite (PWA configured), TailwindCSS for mobile-native UI styling, Recharts for Pie/Line charts.
*   **Backend:** Python 3.11 + FastAPI + SQLite (async via SQLAlchemy or raw SQL).
*   **Web Server / Proxy:** Nginx (Serves static PWA, proxies `/api` to FastAPI).
*   **Observability (LGTM):**
    *   OpenTelemetry Collector Contrib (Data routing).
    *   Prometheus (Metrics storage).
    *   Grafana Loki (Logs storage).
    *   Grafana Tempo (Traces storage).
    *   Grafana (Unified Visualization Dashboard on port `3000`).

## 2. Directory Structure
Create the following directory tree:
```text
money-tracker/
├── docker-compose.yml
├── .env
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/ (manifest.json, icons)
│   └── src/ (components, App.jsx, api.js)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── models.py
│   └── database.db (auto-generated SQLite)
├── nginx/
│   └── default.conf
└── observability/
    ├── otel-collector-config.yaml
    ├── prometheus.yaml
    ├── loki-config.yaml
    ├── tempo.yaml
    └── grafana/
        └── provisioning/
            └── datasources/
                └── datasources.yaml
```

## 3. Backend Implementation (FastAPI)
**Dependencies (`requirements.txt`):** 
`fastapi`, `uvicorn`, `sqlalchemy`, `opentelemetry-api`, `opentelemetry-sdk`, `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-sqlite3`, `opentelemetry-instrumentation-logging`, `opentelemetry-exporter-otlp`.

**Database Schema (SQLite):**
*   `Users`: id, username (default local user for offline use).
*   `Budgets`: id, user_id, month, year, amount.
*   `Expenses`: id, user_id, amount, category, date, description.
*   *Predefined Categories:* Food, Transport, Utilities, Entertainment, Health, Shopping, Others.

**API Routes:**
*   `GET /api/dashboard`: Returns current month's budget, total expenses, expenses by category (for pie chart), and daily/weekly aggregates (for linear charts).
*   `POST /api/expenses`: Add a new expense.
*   `POST /api/budget`: Set/update the monthly budget.

**Observability Setup:**
*   Initialize OTel tracer, meter, and logger providers exporting to OTLP endpoint `http://otel-collector:4318`.
*   Call `FastAPIInstrumentor.instrument_app(app)` to auto-generate request spans.
*   Inject `trace_id` into all application logs.

## 4. Frontend Implementation (React PWA)
**Vite & PWA Config:**
*   Use `vite-plugin-pwa` to generate service workers and `manifest.json` for "Add to Home Screen" functionality.
*   Configure UI to be strictly mobile-responsive (max-width containers, bottom navigation bar).

**Views/Components:**
1.  **Dashboard:**
    *   *Header:* Budget vs. Current Expenses (Progress bar).
    *   *Pie Chart:* Expenses grouped by category (Recharts).
    *   *Line Chart:* Expense trend over the current week and month (Recharts).
2.  **Add Expense Modal/Page:**
    *   Form with Amount, Date Picker, Category Dropdown, and optional note.
3.  **Settings:**
    *   Input to set the Monthly Budget limit.

## 5. Nginx Configuration
Create `nginx/default.conf` to act as the entry point on `0.0.0.0:80`.
*   Listen on port 80.
*   `location /`: Serve the built static files from the React frontend `/usr/share/nginx/html`. (Use `try_files $uri /index.html` for React Router).
*   `location /api/`: `proxy_pass` to `http://backend:8000/`.

## 6. Observability Configurations
Write the following minimal configs to bootstrap the LGTM stack:

*   **`otel-collector-config.yaml`**: Receive via OTLP (grpc/http). Export metrics to `prometheusremotewrite` (Prometheus), logs to `otlphttp` (Loki), traces to `otlp` (Tempo).
*   **`prometheus.yaml`**: Enable remote write receiver (`--enable-feature=otlp-write-receiver`).
*   **`tempo.yaml`**: Configure receivers for OTLP gRPC/HTTP, local storage backend.
*   **`loki-config.yaml`**: Standard local storage config, no authentication required.
*   **`grafana/provisioning/datasources.yaml`**: Auto-provision Prometheus, Loki, and Tempo data sources. Configure trace-to-logs and logs-to-traces derived fields using standard UID mappings.

## 7. Docker Compose Setup
Create a single `docker-compose.yml` to orchestrate everything on an internal bridge network. Ensure all images support `linux/arm64`.

**Services:**
1.  **frontend:** Uses a custom `Dockerfile` (multi-stage: Node build -> Nginx alpine). Maps host port `80` to container `80`.
2.  **backend:** Uses `python:3.11-slim`. Runs `uvicorn main:app --host 0.0.0.0 --port 8000`.
3.  **otel-collector:** Image: `otel/opentelemetry-collector-contrib:latest`.
4.  **prometheus:** Image: `prom/prometheus:latest`.
5.  **loki:** Image: `grafana/loki:latest`.
6.  **tempo:** Image: `grafana/tempo:latest`.
7.  **grafana:** Image: `grafana/grafana:latest`. Maps host port `3000` to container `3000`.

## 8. Execution Commands
To run the project:
1.  Execute: `docker compose up --build -d`
2.  Open `http://localhost:80` for the Money Tracker App.
3.  Open `http://localhost:3000` for the Grafana Observability Dashboard.