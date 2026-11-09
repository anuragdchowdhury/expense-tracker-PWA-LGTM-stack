# Money Tracker PWA & LGTM Observability Stack

Offline-first personal expense and monthly budget tracker built with **React + Vite PWA + Tailwind CSS**, backed by **Python 3.11 + FastAPI + SQLite (WAL mode)**, defaulted to **INR (`₹`)**, and instrumented end-to-end with **OpenTelemetry + Grafana LGTM** (Loki, Grafana, Tempo, Prometheus).

## Quick Start

```bash
docker compose up --build -d
```

- **App & PWA:** http://localhost:80
- **Grafana LGTM UI:** http://localhost:3000 (`admin` / `admin`, anonymous Admin enabled locally)

## Currency Configuration

- Backend defaults to `CURRENCY=INR` in [`.env`](./.env) and exposes `currency` metadata plus the `money_tracker_expense_amount` histogram unit in [`backend/main.py`](./backend/main.py).
- Frontend formats amounts in Indian Rupee (`₹`, `en-IN` locale) via [`frontend/src/utils/currency.js`](./frontend/src/utils/currency.js), with a display selector (`INR`, `USD`, `EUR`, `GBP`) in Settings.

## Documentation Website (`docs/`)

Full technical documentation is published in [`docs/`](./docs/index.html) as a static website ready for **GitHub Pages**:

- [Overview & Tech Stack](./docs/index.html)
- [High-Level Design (HLD)](./docs/hld.html)
- [Low-Level Design (LLD)](./docs/lld.html)
- [Observability & LGTM Setup](./docs/observability.html)

### Hosting on GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Choose branch `main` and folder **`/docs`**, then click **Save**.
