# Agape

Food rescue platform connecting donors with admin-verified NGOs.

- `frontend/` Vite + React + Tailwind v4 + Vitest + Leaflet
- `backend/` FastAPI feature packages (currently `app/reservations`; no app entry point yet)
- `docs/` [design system](docs/design-system.md), [architecture](docs/architecture.md), [integration guide](docs/integration-guide.md)

## Quick start (demo mode, no backend)
```bash
cd frontend
npm install
cp .env.example .env     # VITE_USE_MOCKS=true by default
npm run dev              # http://localhost:5173
```
Open `/login` and use **Continue as NGO / Donor / Admin**, or switch roles from the header. The NGO pages run on in-memory mock data.

## Environment variables (`frontend/.env`)
| Variable | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCKS` | `true` in `.env.example` | `true`: demo users and mock data. `false`: real backend. |
| `VITE_API_BASE` | `/api/v1` | Base path for API calls. |

## Live backend
1. Set `VITE_USE_MOCKS=false` in `frontend/.env`.
2. Run the API on `localhost:8000` (the dev server proxies `/api` there) with routers mounted under `/api/v1`.
3. The login form calls `POST /api/v1/auth/login` (expects `{ "access_token": "..." }`) and then `GET /api/v1/auth/me`, which returns `{ "user": { id, email, role, name, phone }, "profile": {...}, "verification_status": "..." }` (`profile.lat/lng` for NGOs, `null` profile for admins). The token is stored in `localStorage['access_token']`. Roles: `provider`, `ngo`, `admin`.

These auth endpoints are implemented on Role B's branch (`feature/Bhanupriya-B`) and arrive here when it is merged; see `docs/integration-guide.md`.

## Test and build
```bash
cd frontend
npm test          # vitest run
npm run build     # production build to dist/
```

## Branches
Work on feature branches; do not commit directly to `main`.
