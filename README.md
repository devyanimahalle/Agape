# SharePlate 🍽️

A food surplus redistribution platform that connects food donors (restaurants, caterers, general providers) with verified NGOs to minimize food waste and feed communities in need.

> **All impact figures (meals redistributed, kg saved) are estimates based on the constant 0.4 kg per meal.**

📖 **Comprehensive Technical Dossier:** For complete architectural blueprints, workflows, database ER diagrams, state machines, and the live examiner demo script, see the **[Project Master Dossier](docs/PROJECT_OVERVIEW.md)**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · Vite · Tailwind CSS |
| Frontend Tests | Vitest |
| Backend | Python · FastAPI · Pydantic v2 |
| ORM / Migrations | SQLAlchemy 2.0 · Alembic |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose) · bcrypt (passlib) |
| Maps | Leaflet · OpenStreetMap · Nominatim |
| Containers | Docker · Docker Compose |
| CI/CD | GitHub Actions |
| Registry | GitHub Container Registry (GHCR) |
| Deployment | Render |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose v2+
- Node.js 20+ (for frontend dev without Docker)
- Python 3.12+ (for backend dev without Docker)
- Git

### Option 1 — Run with Docker (recommended)

```bash
# Clone the repo
git clone https://github.com/devyanimahalle/Agape.git
cd Agape

# Copy the env template
cp .env.example .env

# Start all services (Postgres + Backend + Frontend)
docker compose -f docker-compose.dev.yml up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

### Option 2 — Run without Docker

**Backend:**
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
# Set DATABASE_URL to point to your Postgres instance
export DATABASE_URL=postgresql://shareplate:shareplate@localhost:5432/shareplate
uvicorn backend.app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Option 3 — Production images from GHCR (laptop demo fallback)

```bash
# Pull pre-built images and start
docker compose up -d

# To use a specific version
TAG=abc1234 docker compose up -d
```

---

## Demo Accounts

All seeded by the seed script. Use these for testing and the live demo:

| Email | Password | Role | State |
|-------|----------|------|-------|
| `admin@shareplate.demo` | `Admin@123` | Admin | Active |
| `restaurant@shareplate.demo` | `Rest@123` | Provider (restaurant) | Fully verified, rated |
| `caterer@shareplate.demo` | `Cater@123` | Provider (caterer) | Step 1 approved, step 2 pending |
| `donor@shareplate.demo` | `Donor@123` | Provider (general) | Active, unrated |
| `ngo1@shareplate.demo` | `Ngo1@123` | NGO | Approved, near demo providers |
| `ngo2@shareplate.demo` | `Ngo2@123` | NGO | Approved, farther away |
| `ngo3@shareplate.demo` | `Ngo3@123` | NGO | Pending admin approval |

> **These are demo-only credentials with dummy documents — never real IDs.**

---

## Testing

### Backend Tests

```bash
# Run all backend tests
pytest backend/tests/ -v

# Run specific module
pytest backend/tests/admin/ -v
pytest backend/tests/impact/ -v

# With coverage
pytest backend/tests/ -v --cov=backend/app
```

### Frontend Tests

```bash
cd frontend
npx vitest run

# Watch mode
npx vitest
```

---

## Deployment

### CI/CD Pipeline

SharePlate uses a two-stage pipeline:

- **CI** (`.github/workflows/ci.yml`) — runs on PRs to `develop`: backend lint + tests, frontend lint + tests, Docker build check.
- **CD** (`.github/workflows/cd.yml`) — runs on merge to `main`: build Docker images → tag → push to GHCR → deploy to Render → health check.

See [CI/CD Pipeline Docs](docs/cicd-pipeline.md) for the full pipeline diagram and details.

### Required Repository Secrets

Set in GitHub → Settings → Secrets → Actions:

| Secret | Purpose |
|--------|---------|
| `RENDER_BACKEND_HOOK` | Render deploy hook URL for backend service |
| `RENDER_FRONTEND_HOOK` | Render deploy hook URL for frontend service |
| `DEPLOY_URL` | Base URL of deployed app (e.g., `https://shareplate.onrender.com`) |

> `GITHUB_TOKEN` is provided automatically by GitHub Actions for GHCR push.

### Rollback

```bash
# Roll back to a specific version using the Git SHA tag
TAG=<sha_short> docker compose up -d
```

---

## Architecture

See [Architecture Docs](docs/architecture.md) for detailed diagrams including:
- System architecture (containers, networking, storage)
- User roles and features
- Data flow (request lifecycle)
- Food listing state machine
- Security model

---

## Project Structure

```
Agape/
├── .github/workflows/        # CI and CD pipelines
│   ├── ci.yml                # Test + lint + Docker build on PRs
│   └── cd.yml                # Build, push GHCR, deploy, health check
├── backend/
│   ├── app/
│   │   ├── admin/            # (Role E) Admin stats, users, proof review
│   │   ├── auth/             # (Role B) Registration, login, JWT
│   │   ├── common/           # Shared deps, database config
│   │   ├── db/               # (Role C) Models, migrations
│   │   ├── impact/           # (Role E) Public impact aggregation
│   │   ├── listings/         # (Role B) Food listing CRUD
│   │   ├── reservations/     # (Role D) NGO reservations
│   │   └── verification/     # (Role C) Provider/NGO verification
│   ├── tests/
│   │   ├── admin/            # Admin endpoint tests
│   │   └── impact/           # Impact aggregation tests
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── design-system/    # (Role A) Shared components
│       ├── features/
│       │   ├── admin-impact/ # (Role E) Admin dashboard, proofs, users, impact
│       │   ├── provider/     # (Role B) Provider dashboard, listings
│       │   ├── verification/ # (Role C) Verification UI
│       │   └── ngo-reservations/ # (Role D) NGO board, reservations
│       ├── layouts/          # (Role A) Page layouts
│       └── pages/public/     # (Role A) Landing, login, register
├── docker/
│   ├── backend/Dockerfile    # Multi-stage Python image
│   └── frontend/             # Multi-stage Vite → Nginx image
│       ├── Dockerfile
│       └── nginx.conf
├── docs/
│   ├── architecture.md       # Architecture diagrams (Mermaid)
│   └── cicd-pipeline.md      # CI/CD pipeline diagrams (Mermaid)
├── docker-compose.yml        # Production (GHCR images)
├── docker-compose.dev.yml    # Development (local build)
├── .env.example              # Environment variable template
└── README.md                 # This file
```

---

## Team

| Role | Responsibility |
|------|---------------|
| **A** | Frontend Lead — Design System, Public Pages, Routing, Guards |
| **B** | Provider & Auth — Registration, Login, Listings CRUD |
| **C** | Verification & Database — Models, Migrations, Seed Data, Verification |
| **D** | NGO Board & Reservations — Board, Reserve, Complete, Geocoding |
| **E** | Admin, Impact & Release — Admin Dashboard, Impact, CI/CD, Docker |

---

## API Base

All endpoints are prefixed with `/api/v1`. Full API documentation is auto-generated at `/docs` (Swagger UI) when the backend is running.

## License

MIT
