# Agape Architecture (frontend)

Stack: Vite + React 19 (`.jsx`) + Tailwind v4 + React Router + Vitest + Leaflet. Backend: FastAPI (Python).

## Folder structure
```
frontend/src/
  main.jsx                 entry: BrowserRouter > AuthProvider > App
  App.jsx                  route table, Layout, ErrorBoundary (Role A owns)
  lib/api.js               shared api() fetch wrapper, token helpers, ApiError
  context/AuthContext.jsx  session state, demo role switcher (mock mode)
  components/              shell: Layout, ProtectedRoute, ErrorBoundary
  components/ui/           kit: Button Card Badge StatusPill EmptyState LoadingState Modal
  pages/                   top-level pages owned by Role A (HomePage)
  features/<name>/         one folder per role's feature, exports pages from index.js
    ngo-reservations/      Role D (do not edit from the shell)
  styles/index.css         Tailwind @theme design tokens
  test/setup.js            Vitest setup (jest-dom, cleanup)
backend/app/<feature>/     one package per feature (reservations = Role D)
docs/                      design-system.md, architecture.md, integration-guide.md
```

## Route map
| Path | Page | Guard |
|---|---|---|
| `/` | `pages/HomePage` | public |
| `/ngo` | `features/ngo-reservations` `NgoBoardPage` | role `ngo` |
| `/ngo/reservations` | `NgoReservationsPage` | role `ngo` |
| `*` | NotFound | public |

## Auth and roles
- Token key: `localStorage['access_token']` (read by `lib/api.js`).
- Roles: `provider` (shown as "Donor"), `ngo`, `admin`. `provider` and `ngo` are used by the backend today; `admin` is assumed and must be confirmed by whoever builds auth.
- `AuthContext` calls `GET /auth/me` when `VITE_USE_MOCKS` is not `true`. With `VITE_USE_MOCKS=true` it provides a demo user and a Donor/NGO/Admin switcher in the header.
- `GET /auth/me` (Role B) returns `{ user: { id, email, role, name, phone }, profile, verification_status }`. `profile` holds the provider/NGO profile columns (NGOs include `lat`, `lng`) and is `null` for admins. `AuthContext` (`parseMe`) unwraps `data.user` (falling back to a flat top-level user if `user` is absent) and exposes `user`, `profile` and `verificationStatus` through `useAuth()`.
- `POST /auth/login` returns `{ access_token, token_type, user, landing }`; the frontend uses only `access_token`.
- These endpoints live on Role B's branch and are not on `feature/RoleA` yet (see `integration-guide.md`).

## Env
`VITE_API_BASE` (default `/api/v1`), `VITE_USE_MOCKS` (`true` = demo user and Role D's mock data). Dev server proxies `/api` to `localhost:8000`.

## Known gaps
- The backend has no app entry point yet. Routers must be mounted under `/api/v1`.
- No login screen. Without a token, guarded routes show "Sign in required".
- Role D's `features/ngo-reservations/api.js` still has its own request code instead of the shared `api()`.

## Honest-claims rules
See `design-system.md`: admin-verified NGOs, FSSAI number format check plus admin review, documents stored privately, estimated meal impact.
