# AWS - TourFlow

This repository contains a FastAPI backend and two Next.js applications:

- **FastAPI backend** (`backend/`): authenticated API for travel planning and trip services.
- **Operator dashboard** at the repository root (`src/`): tools for bookings, trips, disruptions, recovery, vendors, customers, and audit.
- **Traveler application** in [`frontend/`](./frontend): traveler sign-in, trip planning, itineraries, bookings, budgeting, and trip assistance.

## Run the backend

Create and activate a Python 3.11+ virtual environment, then from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn app.main:app --app-dir backend --reload
```

Configure Supabase and PostgreSQL settings in `.env` and apply the SQL migration in `supabase/migrations`. The default SQLite database is intended only for local development and tests. PostgreSQL deployments must apply the checked-in migration. Configure `TOURFLOW_CORS_ORIGINS` as a comma-separated allowlist. AI routes return `AI_PROVIDER_ERROR` until server-side AI provider settings are configured.

Interactive API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs); the API contract is in [`api/openapi.yaml`](./api/openapi.yaml).

## Run the operator dashboard

From the repository root:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure the Supabase environment variables required by the operator app before using authenticated features.

### AI Trip Planner provider configuration

The operator sidebar includes an AI Trip Planner. It uses the server-side AI settings above to create itinerary suggestions. To include cited web research, configure `TOURFLOW_SEARCH_API_KEY` with a Tavily API key. To check live flight offers, configure `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, and `AMADEUS_BASE_URL`; the planner requires 3-letter IATA codes for flight searches. Keep these credentials server-side and out of `NEXT_PUBLIC_` variables.

Train/bus searches and Ola, Uber, and Rapido currently open provider/search pages; their prices are not quoted in TourFlow because those providers do not have credentials/API integrations configured here. The planner does not fabricate live prices.

## Run the traveler application

From the repository root:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

The traveler application runs at [http://localhost:3000](http://localhost:3000) when started separately. Configure the Supabase environment variables required by this app before using authenticated features.

## Checks

```powershell
pytest
ruff check backend
```

Keep local environment files out of version control.
