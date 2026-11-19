# Integration guide (Role B, Role C, Role D)

Role A owns the shell (`App.jsx`, `Layout`, `AuthContext`, `lib/api.js`, `components/ui`, `styles/index.css`). Everyone else works inside their own folders so merges stay clean.

## Rules to avoid merge conflicts
1. Frontend code goes only in `frontend/src/features/<your-feature>/`. Backend code goes only in `backend/app/<your-feature>/`.
2. Export your pages from `features/<your-feature>/index.js` (see `ngo-reservations/index.js`).
3. Do not edit `package.json`, `vite.config.js`, `index.html` or `styles/index.css` in your branch. Ask Role A, or put the change in a separate small commit.
4. To get a route, tell Role A the path, the export name and the allowed roles. Role A adds one line to `App.jsx`:
   `<Route path="/donor" element={<ProtectedRoute roles={['provider']}><DonorPage /></ProtectedRoute>} />`
5. Add tests next to your code (`__tests__/`). Run `npx vitest run` and `npx vite build` before opening a PR.
6. Branch from `feature/RoleA` (or rebase on it), and never push to `main` directly.

## Shared pieces
**`api()`** (`src/lib/api.js`)
```js
import { api, ApiError } from '../../lib/api'
const board = await api('/board', { params: { lat, lng } })
await api(`/listings/${id}/reserve`, { method: 'POST' })
await api('/things', { method: 'POST', json: { a: 1 } })   // JSON body
await api(`/listings/${id}/complete`, { method: 'POST', form })  // FormData
```
It prefixes `VITE_API_BASE`, adds `Authorization: Bearer <token>` from `localStorage['access_token']`, and throws `ApiError(status, code, detail)`.

**Auth:** `const { user, loading, logout } = useAuth()` from `context/AuthContext`. `user.role` is `provider`, `ngo` or `admin`. Role B's login must store its token with `setToken(token)` (key `access_token`).

**UI kit:** `import { Button, Card, Badge, StatusPill, EmptyState, LoadingState, Modal } from '../../components/ui'`. Use tokens (`bg-canvas`, `bg-panel`, `bg-primary`, `border-line`, `text-muted`). Yellow is only a background behind dark text.

**Demo mode:** with `VITE_USE_MOCKS=true` the header shows a role switcher so every guarded route can be demoed without a backend.

## Role B (auth, listings, backend entrypoint)
Role B's branch `origin/feature/Bhanupriya-B` (not merged here yet) already provides `backend/app/main.py`, `backend/requirements.txt`, `backend/app/auth/` (`/auth/register`, `/auth/login`, `/auth/me`), `backend/app/listings/`, `backend/app/errors.py`, a Dockerfile and a CI workflow. **Do not create `backend/app/main.py` or `backend/requirements.txt` on `feature/RoleA`**; that would cause add/add conflicts. Use the checklist below when the branches are merged.
- Frontend: Role A owns `/login` (done). A register page can go in `features/auth/` once Role B confirms the form fields (`POST /auth/register` needs role-specific fields such as `org_name`, `address`, `lat`, `lng`, `reg_number`).

## Merge checklist: Role B + Role D (backend)
Verified against `origin/feature/Bhanupriya-B` at `e65ca6f` and `backend/app/reservations` from `branch-d`.

**1. Mount Role D's router and error handler** in `backend/app/main.py`
- Add Role D's router to the `ROUTERS` list. It carries no prefix, and `main.py` already applies `/api/v1`:
  ```python
  from app.reservations import router as board_router
  ROUTERS = [auth_router, listings_router, board_router]   # replaces the "# board_router  # Role D" comment
  ```
- Role D's errors use `app.reservations.errors.ApiError`, which Role B's handlers do not catch. Register Role D's handler inside `create_app()`. Both modules export `register_error_handlers`, so alias the import:
  ```python
  from app.reservations import register_error_handlers as register_reservation_errors
  register_error_handlers(app)          # Role B (app.errors)
  register_reservation_errors(app)      # Role D
  ```
- No path collisions: Role B uses `/listings`, `/listings/mine`, `/listings/{id}` and `/listings/{id}/cancel`. Role D uses `/listings/{id}/reserve|cancel-reservation|complete|rate-provider`, plus `/board`, `/geocode` and `/ngo/reservations`.
- Auth seam needs no edit: Role D's `deps.py` imports `app.auth.dependencies.get_current_user`, which exists on Role B's branch and returns the `User` (`.id`, `.role`).
- Expiry: Role B starts an APScheduler job in `lifespan`. Role D's `expiry_lifespan` does the same for `listed` listings. Keep only Role B's job unless the two are confirmed not to overlap.

**2. CORS and requirements**
- Add to `create_app()` (reads `CORS_ORIGINS`, comma-separated, default `http://localhost:5173`):
  ```python
  import os
  from fastapi.middleware.cors import CORSMiddleware
  origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
  app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                     allow_methods=["*"], allow_headers=["*"])
  ```
  The Vite dev proxy hides the need for CORS locally, but a deployed frontend on another origin needs it.
- Append to `backend/requirements.txt`: `httpx>=0.27` (Role D's geocoder), `psycopg[binary]>=3` (Role D's `postgresql+psycopg://` URLs; Role B lists `psycopg2-binary`, so pick one driver per `DATABASE_URL`). Role B's `requirements-roleB.txt` already has `httpx` for tests. Role D also needs `python-multipart` (already listed).

**3. Database layer (missing on both branches)**
- Neither branch contains `backend/app/db/models.py` or `session.py`, yet both import them. Someone must add them.
- `Base` must be exported from **both** places: Role B's tests use `from app.db.session import Base, get_db`, and Role D's tests use `from app.db.models import Base, ...`. Define `Base` in `session.py` and re-export it in `models.py`.
- `session.py` must export `get_db` and `SessionLocal`. `models.py` must define `User, ProviderProfile, NgoProfile, Document, Listing, Proof, Rating`. Column names Role D reads are in `backend/app/reservations/README.md` and `tests/reservations/conftest.py`. `NgoProfile` needs `lat` and `lng`.

**4. Frontend contract: `/auth/me` and `/auth/login` shapes differ from what `AuthContext` assumes**
- Role B's `/auth/me` returns **nested** JSON: `{ "user": { id, email, role, name, phone }, "profile": { ...all profile columns }, "verification_status": "pending|approved|..." }`.
  - `profile.lat` / `profile.lng` come through for NGOs because the profile is dumped column by column, so Role D's `me.profile.lat/lng` works as long as `NgoProfile` has those columns. Verify with a seeded NGO once the DB layer exists.
- **Done on Role A's side:** `AuthContext.parseMe()` already unwraps `{ user, profile, verification_status }` (falling back to a flat user), `LoginPage` calls `/auth/login` then `refresh()` (`/auth/me`), and `useAuth()` exposes `user`, `profile` and `verificationStatus`. Covered by `AuthContext.test.jsx` and `LoginPage.test.jsx` (including the exact Role B payloads and the `403 ACCOUNT_DISABLED` message). Nothing more to change in the frontend for auth.
- Role D's mock `getMe()` returns the flat `profile` shape, so `features/ngo-reservations` works with both.
- `/auth/login` returns `{ access_token, token_type, user: { id, email, role, name }, landing }`. `LoginPage` only uses `access_token`, which matches. `landing` is `/provider`, `/ngo` or `/admin`. The frontend routes by role itself (`homeForRole` in `lib/routes.js`): NGO to `/ngo`, donor/provider to `/provider`, admin to `/admin`, anything else to `/`. A safe same-site `?next=` (checked by `safeNext`) takes precedence. `/ngo` is the full NGO workflow; `/provider` and `/admin` are role-gated placeholder pages (`RoleHomePage`, marked "In development") that Role B / admin work should replace by swapping the element on those two routes in `App.jsx`.
- Errors follow `{ detail, code }`; unauthenticated calls return `401 NOT_AUTHENTICATED` and bad login returns `401 INVALID_CREDENTIALS`. `LoginPage` already treats 401 as incorrect credentials.

**5. Verify after merging**
`cd backend && pip install -r requirements.txt && uvicorn app.main:app`, then `/health` (200), `/docs` lists `/api/v1/board` and the auth routes, log in from the frontend with `VITE_USE_MOCKS=false`, `/ngo` loads. Run Role B's and Role D's pytest suites (Role D's need PostgreSQL via `TEST_DATABASE_URL`).

## Role C
Scope to be confirmed. Follow the same pattern: `features/<name>/`, `backend/app/<name>/`, a short README, and a request to Role A for routes and roles.

## Role D (already merged)
`/ngo` and `/ngo/reservations` are routed and role-guarded. To switch from mocks to the real backend: set `VITE_USE_MOCKS=false` and follow the merge checklist above. Optional follow-up: have `ngo-reservations/api.js` use the shared `api()`.

## Copy rules
Use the wording in `design-system.md`. Never write "FSSAI verified" or invent statistics.

## Role A integration check (verified against `origin/feature/Bhanupriya-B` at `e65ca6f`)
- **Present on `feature/RoleA`:** only `backend/app/reservations/` and `backend/tests/reservations/` (Role D). There is no `main.py`, `auth/`, `listings/`, `errors.py` or `db/` here.
- **Arrives from Role B:** `main.py`, `auth/`, `listings/`, `errors.py`, `requirements.txt`, Dockerfile, CI. Role B's branch has **no** `backend/app/db/` either, so `models.py` and `session.py` (step 3 above) are still unowned. Do not invent them before the merge.
- **Frontend wiring confirmed:** `API_BASE` defaults to `/api/v1` (matches Role B's `API_PREFIX`, and Vite proxies `/api` to `:8000`). `USE_MOCKS` is true only when `VITE_USE_MOCKS === 'true'`; with it off, `AuthContext` loads `/auth/me` when a token exists. Errors `{ detail, code }` map to `ApiError`; FastAPI 422 list details fall back to "Something went wrong".
- **Role mapping:** backend roles `provider | ngo | admin` and `landing` values match `homeForRole`. Provider status comes from `profile.verification_status`, NGO status from `profile.status`; both arrive as the single `verification_status` field, where `approved` shows as "Admin-verified".
