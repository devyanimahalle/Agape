# Integration guide (Role B, Role C, Role D, Role E)

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
Role B's branch `origin/feature/Bhanupriya-B` (now merged into `feature/RoleA` locally, see the status sections at the end) already provides `backend/app/main.py`, `backend/requirements.txt`, `backend/app/auth/` (`/auth/register`, `/auth/login`, `/auth/me`), `backend/app/listings/`, `backend/app/errors.py`, a Dockerfile and a CI workflow. **Do not create `backend/app/main.py` or `backend/requirements.txt` on `feature/RoleA`**; that would cause add/add conflicts. Use the checklist below when the branches are merged.
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

**3. Database layer (implemented on `feature/RoleA` in `backend/app/db/`; neither source branch had it)**
- Neither source branch contained `backend/app/db/models.py` or `session.py`, yet both import them. They now exist on `feature/RoleA` (see "Database layer" at the end of this file); the notes below describe what they satisfy.
- `Base` must be exported from **both** places: Role B's tests use `from app.db.session import Base, get_db`, and Role D's tests use `from app.db.models import Base, ...`. Define `Base` in `session.py` and re-export it in `models.py`.
- `session.py` must export `get_db` and `SessionLocal`. `models.py` must define `User, ProviderProfile, NgoProfile, Document, Listing, Proof, Rating`. Column names Role D reads are in `backend/app/reservations/README.md` and `tests/reservations/conftest.py`. `NgoProfile` needs `lat` and `lng`.

**4. Frontend contract: `/auth/me` and `/auth/login` shapes differ from what `AuthContext` assumes**
- Role B's `/auth/me` returns **nested** JSON: `{ "user": { id, email, role, name, phone }, "profile": { ...all profile columns }, "verification_status": "pending|approved|..." }`.
  - `profile.lat` / `profile.lng` come through for NGOs because the profile is dumped column by column, so Role D's `me.profile.lat/lng` works as long as `NgoProfile` has those columns. Verify with a seeded NGO once the DB layer exists.
- **Done on Role A's side:** `AuthContext.parseMe()` already unwraps `{ user, profile, verification_status }` (falling back to a flat user), `LoginPage` calls `/auth/login` then `refresh()` (`/auth/me`), and `useAuth()` exposes `user`, `profile` and `verificationStatus`. Covered by `AuthContext.test.jsx` and `LoginPage.test.jsx` (including the exact Role B payloads and the `403 ACCOUNT_DISABLED` message). Nothing more to change in the frontend for auth.
- Role D's mock `getMe()` returns the flat `profile` shape, so `features/ngo-reservations` works with both.
- `/auth/login` returns `{ access_token, token_type, user: { id, email, role, name }, landing }`. `LoginPage` only uses `access_token`, which matches. `landing` is `/provider`, `/ngo` or `/admin`. The frontend routes by role itself (`homeForRole` in `lib/routes.js`): NGO to `/ngo`, donor/provider to `/provider`, admin to `/admin`, anything else to `/`. A safe same-site `?next=` (checked by `safeNext`) takes precedence. `/ngo` is the full NGO workflow; `/provider` is the donor area and now hosts Role C's verification stepper (the old `RoleHomePage` placeholder was removed). `/admin` is now Role E's real admin surface (see Role E below).
- Errors follow `{ detail, code }`; unauthenticated calls return `401 NOT_AUTHENTICATED` and bad login returns `401 INVALID_CREDENTIALS`. `LoginPage` already treats 401 as incorrect credentials.

**5. Verify after merging**
`cd backend && pip install -r requirements.txt && uvicorn app.main:app`, then `/health` (200), `/docs` lists `/api/v1/board` and the auth routes, log in from the frontend with `VITE_USE_MOCKS=false`, `/ngo` loads. Run Role B's and Role D's pytest suites (Role D's need PostgreSQL via `TEST_DATABASE_URL`).

## Role C: provider and NGO verification (merged from `origin/feature/Spidey-056-C`)
See the Role C section at the end of this file.

## Role D (already merged)
`/ngo` and `/ngo/reservations` are routed and role-guarded. To switch from mocks to the real backend: set `VITE_USE_MOCKS=false` and follow the merge checklist above. Optional follow-up: have `ngo-reservations/api.js` use the shared `api()`.

## Copy rules
Use the wording in `design-system.md`. Never write "FSSAI verified" or invent statistics.

## Role A integration check (verified against `origin/feature/Bhanupriya-B` at `e65ca6f`)
- **Status:** Role B's branch (`e65ca6f`) is merged here; `backend/app/db/` was added on top because neither branch had it.
- **Frontend wiring confirmed:** `API_BASE` defaults to `/api/v1` (matches Role B's `API_PREFIX`, and Vite proxies `/api` to `:8000`). `USE_MOCKS` is true only when `VITE_USE_MOCKS === 'true'`; with it off, `AuthContext` loads `/auth/me` when a token exists. Errors `{ detail, code }` map to `ApiError`; FastAPI 422 list details fall back to "Something went wrong".
- **Role mapping:** backend roles `provider | ngo | admin` and `landing` values match `homeForRole`. Provider status comes from `profile.verification_status`, NGO status from `profile.status`; both arrive as the single `verification_status` field, where `approved` shows as "Admin-verified".

## Backend merge status on `feature/RoleA` (Role B `e65ca6f` + Role D)
Role B's branch was merged into `feature/RoleA` locally (clean, no conflicts). Applied on top of it:
- `backend/app/main.py`: `board_router` (Role D) added to `ROUTERS`; Role D's error handler registered via the `register_reservation_errors` alias (it only handles `ApiError`, so Role B's handlers are unaffected); CORS middleware reading `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`). Role B's expiry scheduler is kept; Role D's `expiry_lifespan` is not used (the two would overlap).
- `backend/requirements.txt`: added `httpx>=0.27` and `psycopg[binary]>=3`. Role B's list still has `psycopg2-binary`; use `postgresql+psycopg://` URLs (Role D) or drop one driver. `PyJWT`, `bcrypt` and `APScheduler` are already in Role B's `requirements.txt`.

## Database layer (`backend/app/db/`, implemented)
- `session.py` exports `Base`, `engine`, `SessionLocal` and `get_db`. It reads `DATABASE_URL`; when unset it falls back to a local SQLite file (`sqlite:///./agape_dev.db`, git-ignored via `*.db`). `postgres://` is rewritten to `postgresql://`. Use `postgresql+psycopg://` (psycopg v3, what Role D's tests and `.env.example` use) or `postgresql+psycopg2://` (Role B's CI) depending on the installed driver.
- `models.py` re-exports `Base` and defines `User, ProviderProfile, NgoProfile, Document, Listing, Proof, Rating` plus `init_db()` (calls `create_all`; there are no Alembic migrations yet, so run it once on a fresh database).
- `ProviderProfile.user_id` and `NgoProfile.user_id` are **primary keys**, so `db.get(NgoProfile, user.id)` in Role D's `require_verified_ngo` and `ngo_location` works.
- Columns were derived from every use in `app/auth`, `app/listings`, `app/reservations` and the tests: `Listing` has exactly the fields `listing_out()` and Role D's `ListingOut` expose (`reserved_by_ngo_id`, `reserved_at`, `completed_at`, `created_at` included); `Proof.review_status` defaults to `pending` (Role D's tests assert it); `Rating` has `UNIQUE(listing_id, kind)` (Role D relies on it as the last line of defence); `User.password_hash` defaults to an unusable `"!"` so Role D's test factories can create users without a password; `ProviderProfile.rating_avg` is nullable and `rating_count` defaults to 0. There are no ORM relationships because nothing navigates one.
- Verified here: Role B's suite (`tests/auth`, `tests/listings`, 70 tests, which also imports `app.main` with Role D's router wired) passes on SQLite, and a smoke script exercised Role D's `get_board`, `reserve_listing` (including the double-reserve 409), `cancel_reservation`, `my_reservations` and the rating uniqueness on SQLite.
- **Not verified:** Role D's own pytest suite (`tests/reservations`) needs PostgreSQL and has not been run; run it with `TEST_DATABASE_URL` set before relying on the concurrency guarantees. Column lengths, indexes and `ON DELETE` rules are reasonable defaults rather than a published contract, so confirm them with Role B / the contract owner before the first real migration.

## Running the live stack locally (seed, API, frontend)
- `main.py` calls `init_db()` in its lifespan (before Role B's expiry scheduler, which needs the tables); `AUTO_CREATE_TABLES=0` turns that off. Role B's tests build the app without running the lifespan, so they are unaffected.
- `backend/app/db/seed.py` is idempotent and uses `hash_password` from `app.auth.security` and the real model fields. It matches accounts by email and listings by (provider, title).

**Local live stack (SQLite, no PostgreSQL needed).** Three terminals:
```bash
# 1. backend (from backend/): create demo data, then start the API on :8000
cd backend
pip install -r requirements.txt
python -m app.db.seed            # idempotent; creates tables and demo data in ./agape_dev.db
uvicorn app.main:app --reload

# 2. frontend (from frontend/): real API instead of mocks; Vite proxies /api to :8000
cd frontend
VITE_USE_MOCKS=false npm run dev      # PowerShell: $env:VITE_USE_MOCKS='false'; npm run dev
```
Demo logins (created by `python -m app.db.seed`; demo data only):

| Role | Email | Password | Lands on |
|---|---|---|---|
| NGO (approved, saved location in Delhi) | `ngo@agape.demo` | `Ngo@12345` | `/ngo` |
| Donor / provider (restaurant, approved) | `provider@agape.demo` | `Provider@123` | `/provider` |
| Admin | `admin@agape.demo` | `Admin@123` | `/admin` |

The seed also adds three open listings near the NGO (2 to 8 km away). Re-running it resets these passwords and moves
the demo listings' windows forward, so run it again before a demo if the listings have expired. Set `DATABASE_URL`
to use PostgreSQL instead; set `AUTO_CREATE_TABLES=0` to stop the API creating missing tables at startup.
Quick API check: `POST /api/v1/auth/login`, then `GET /api/v1/auth/me` and `GET /api/v1/board` with
`Authorization: Bearer <access_token>` (the board route is `/api/v1/board`).

## Rule: restyle every merged teammate feature

**Mandatory:** every newly integrated teammate UI must be audited and restyled to Agape's design system (`docs/design-system.md`) upon merge, before the merge is committed. Audit by grepping the feature for `shadow`, `border-l-`, `rounded-lg`/`rounded-xl`, `gray-`/`blue-`/`green-`/`red-`/`amber-` classes and emoji, then check `/` screenshots at desktop and mobile widths. Role D's `features/ngo-reservations`, Role E's `features/admin-impact` and Role C's `features/verification` have all been through this pass. Concretely: start each page with the shared `PageHeader` band; build on `Card`, `Button`, `Badge`, `StatusPill`, `EmptyState`, `LoadingState` from `components/ui`; use only the palette tokens (`canvas`, `panel`, `ink`, `muted`, `brand*`), Anton for display numerals and DM Mono for text; no drop shadows, no coloured border stripes, no emoji icons, no generic blue/green/yellow progress bars; keep the honest-copy rules (say "estimate" next to meal figures). Keep every API call, data field and action unchanged. Role E's screens are the worked example (`features/admin-impact`).

## Role E: admin and impact (merged from `origin/feature/sonli-admin-impact`)

- **Backend:** `app/admin` (router, service, schemas) and `app/impact` are mounted in `ROUTERS` in `backend/app/main.py`. Endpoints, all under `/api/v1`: `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/{id}`, `GET /admin/proofs?review=`, `POST /admin/proofs/{id}/review` (admin only, via `app.auth.dependencies.require_role`), and the public `GET /impact`.
- **Conflict policy:** Role E's branch carried its own `main.py`, `db/models.py`, `db/session.py`, `requirements.txt`, `tests/conftest.py`, README, architecture doc and `.env.example`. Ours were kept; only `.gitignore` was unioned. Role E's stub auth (`app/common/deps.py`) and `app/common/database.py` are still present but unused, because the admin router prefers `app.auth.dependencies` and `app.db.session`. Role E's Docker files, CI workflows and `docs/cicd-pipeline.md` came in unchanged and have not been run here.
- **Models:** added `NgoProfile.rating_avg` (nullable, set by proof review) and read-only relationships `User.provider_profile`, `User.ngo_profile`, `Listing.provider`, `Proof.listing`, `Proof.ngo`. Role E's old dev databases need the new `ngo_profiles.rating_avg` column: `create_all` does not alter existing tables, so delete `backend/agape_dev.db` (or run an `ALTER TABLE`) and re-seed.
- **Tests:** `tests/admin` and `tests/impact` run against the shared app and engine. `tests/conftest.py` gained `db_session`, `admin_client`, `provider_client` and `ngo_client` (auth overridden with a stand-in user). Role E's listing fixtures were given the required `window_start`, `window_end` and `address`.
- **Frontend:** `features/admin-impact` is wired in `App.jsx`: `/admin` (dashboard), `/admin/proofs`, `/admin/users` (admin only) and `/impact` (public). `Layout` shows Admin, Proofs and Users links for admins and an Impact link for everyone. Its `api.js` now uses the shared `api()` wrapper and `USE_MOCKS` (`VITE_USE_MOCKS=true` gives sample data); Role E's own `VITE_API_URL`/`VITE_USE_MOCK` are no longer read.
- **Known gaps:** the proof review stores the admin's star rating in `ratings` with kind `admin_to_ngo`; nothing sets `Proof.reviewed_by`/`reviewed_at` (columns Role E's model had are not in ours). The seed has no proofs yet, so the proof queue is empty against the live API.

## Role C: provider and NGO verification (merged from `origin/feature/Spidey-056-C`)

Member C's branch is the verification module (not donor listing screens): provider two-step verification, NGO onboarding and the admin decision queue. `backend/app/listings` and `backend/app/auth` on that branch were identical to ours (it had already merged `feature/RoleA` and Role B).

- **Backend:** `app/verification` (router, service, `FssaiVerifier`) and `app/common/uploads.py` are mounted in `ROUTERS`. Endpoints under `/api/v1`: `POST /verification/provider/step1` and `/step2` (multipart), `GET /verification/provider/status`, `POST /verification/ngo` (multipart), `GET /admin/verifications?status=&type=`, `POST /admin/verifications/{id}/decision` (form: `decision=approved|rejected`, `reason`, required on reject) and `GET /admin/documents/{id}` (admin only, streams the private file). Additions made while integrating: `GET /verification/ngo/status`, and `user_email`, `user_name` and `org_name` on each admin list row, because the UI needs them. General providers do not need verification (403 `NOT_REQUIRED`). Only masked PAN and Aadhaar are stored, and the identity documents are soft-deleted once step 1 is decided.
- **Conflict policy:** add/add conflicts in `db/__init__.py`, `db/session.py`, `db/models.py` and `docker-compose.yml`. Ours were kept. Their models were folded in: new `VerificationRequest` table and `Document.deleted_at`. Their SharePlate check constraints, naming convention, Alembic migration (`app/db/migrations`, `001_initial_schema`) and compose stack came in unchanged and are not used or verified here; schema creation is still `init_db()`. Existing dev databases need the new table and column: delete `backend/agape_dev.db` and re-seed.
- **Frontend:** `features/verification` is routed as `/provider` (donor, `ProviderVerificationPage`), `/ngo/onboarding` (NGO) and `/admin/verifications` (admin). `Layout` shows Verification, Onboarding and Verifications links to the matching role. Its `api.js` was rewritten as an adapter: the branch's UI called paths and shapes the backend does not have (`/provider/verification`, JSON bodies, `/decide`, `rejection_reason`, `document_id`). The pages keep the adapted shapes; the real backend contract is documented at the top of `api.js`. The forms now collect what the backend requires: step 1 is business name, business registration document, PAN and Aadhaar; step 2 is business name, FSSAI number and certificate; NGO onboarding is registration number and certificate (the organisation name comes from the account).
- **Known gaps:** there is still no donor listing-creation screen; the backend `POST /listings` exists but nothing in the frontend calls it. Passport upload (the PAN+Aadhaar alternative) is supported by the backend but not offered in the UI. The seeded demo providers and NGOs have no verification requests. Nothing yet stops an unverified provider listing food or links the NGO onboarding screen from the board.

## Donor listings and the demo seed
- **Frontend:** `features/provider-listings` is routed as `/provider/listings` (donor only), linked from the header ("Listings") and from `/provider`. It uses Role B's `GET /listings/mine` and `POST /listings` (title, food type, quantity, unit, collection window, address, lat, lng, notes). The server computes `est_meals` and `est_kg`; the page always labels them as estimates. Gating mirrors the backend's `is_verified`: a donor can list if `profile.category === 'general'` or `/auth/me`'s `verification_status === 'approved'` (the demo donor counts as verified in mock mode). Unverified donors see a gate card linking to `/provider` and the page makes no listing calls, because the backend answers `NOT_VERIFIED` (403) to them anyway.
- **Seed (`backend/app/db/seed.py`):** now also creates `pending.ngo@agape.demo` with one pending `VerificationRequest` and a registration PDF, and one completed pickup (a listing reserved and completed by the demo NGO; there is no separate reservation table) with a pending `Proof` and a photo. Both are created once and never reset after an admin decides them. The files are written under `PRIVATE_UPLOAD_DIR` (default for the seed: `backend/.private_uploads`, git-ignored); start the API with the same value or the admin document viewer reports "Document not found".
- **Known gaps:** donors cannot edit or cancel a listing from the UI yet, and the listing form takes coordinates by hand or from the browser location (there is no map picker).
