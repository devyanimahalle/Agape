# Demo and verification checklist

Run from `frontend/` unless stated. Tick each item before the Expo (20 Nov 2026, 9am IST).

## 0. Always (both modes)
- [ ] `npm install`
- [ ] `npm test` passes (`vitest run`)
- [ ] `npm run build` succeeds
- [ ] On branch `feature/RoleA`; nothing unintended in `git status`

## A. Mock mode (`VITE_USE_MOCKS=true`, no backend)
Setup: `cp .env.example .env` (defaults to mock mode), then `npm run dev` and open http://localhost:5173.

**Walkthrough**
- [ ] `/` landing page loads: "Surplus food, collected in time", the three steps, the "what we check, and what we don't claim" section, and role cards (all three link to their area; nothing is marked "In development").
- [ ] Header shows a **Demo mode** badge and a role dropdown (Donor / NGO / Admin).
- [ ] `/login` shows the form plus **Continue as NGO / Donor / Admin** buttons. After sign-in each role lands on its own home: NGO `/ngo`, Donor `/provider`, Admin `/admin` (unless a safe same-site `?next=` path is present, which wins).
- [ ] **Continue as Donor** opens `/provider` (Role C's verification stepper) and **Continue as Admin** opens `/admin` (Role E's admin dashboard with stat cards).
- [ ] `/login?next=/ngo/reservations` shows "Sign in to continue." and returns there after sign-in; `?next=//evil.com` is ignored and the role home is used.
- [ ] **Continue as NGO** goes to `/ngo`: list of nearby listings, estimated meals labelled as estimates, List/Map toggle (map tiles and markers show).
- [ ] Reserve a listing: a confirmation appears first; the card then moves to **My reservations** (`/ngo/reservations`).
- [ ] Complete pickup needs at least one PDF/JPG/PNG proof (10 MB cap); try a wrong file type and see the error.
- [ ] Switch the header dropdown to **Donor**: `/ngo` shows "Not available for your role"; **Account** shows the Donor role.
- [ ] Switch to **Admin**: `/account` shows "Not applicable for admin accounts."
- [ ] `/account` shows the "Demo mode: sample session, not a real account" banner.
- [ ] `/does-not-exist` shows "Not found" with a link home.

**Copy and honesty check**
- [ ] Wording is "admin-verified NGOs", "FSSAI number format check plus admin review", "documents are stored privately", "estimated meals".
- [ ] Nowhere says "FSSAI verified" or shows invented statistics.
- [ ] No yellow text on light backgrounds; text is dark on yellow.

## B. Live backend (`VITE_USE_MOCKS=false`)
Prerequisite: Role B's branch is merged and the backend runs on `localhost:8000` with routers under `/api/v1`. Follow the merge checklist in [`integration-guide.md`](integration-guide.md) first (Role D router and error handler registered, CORS, `httpx` and `psycopg[binary]` installed, `app/db` models and session present, `Base` exported from both files).

Setup
- [ ] PostgreSQL running; `DATABASE_URL` set (see root `.env.example`); `CORS_ORIGINS=http://localhost:5173`
- [ ] Backend: `cd backend && pip install -r requirements.txt && python -m app.db.seed && uvicorn app.main:app --reload`
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}`; `/docs` lists the auth routes and `/api/v1/board`
- [ ] Frontend: `VITE_USE_MOCKS=false npm run dev` (or set it in `frontend/.env` and restart)
- [ ] Backend tests: Role B's suite and Role D's `pytest tests/reservations` (needs PostgreSQL via `TEST_DATABASE_URL`)

Seed data: `python -m app.db.seed` creates an admin, an approved NGO with `lat`/`lng`, an approved restaurant donor and three open listings near the NGO.
- [ ] Demo logins: NGO `ngo@agape.demo` / `Ngo@12345`, Donor `provider@agape.demo` / `Provider@123`, Admin `admin@agape.demo` / `Admin@123`.
- [ ] To test the unapproved path, register a second NGO through `POST /api/v1/auth/register` (it starts as `pending`).

**Walkthrough**
- [ ] No token: `/ngo` shows "Sign in required" with a **Sign in** link; header shows **Sign in**.
- [ ] Wrong password at `/login` shows "Email or password is incorrect."
- [ ] Sign in as the approved NGO (`ngo@agape.demo`): redirected to `/ngo`; `localStorage['access_token']` is set; **Account** shows name, email, role and "Admin-verified".
- [ ] `/ngo` loads the real board nearest-first using the NGO's saved location (`/auth/me` `profile.lat/lng`).
- [ ] Reserve a listing: succeeds once; reserving the same listing again (second browser or user) returns the "already taken" message.
- [ ] Complete pickup with a real PDF/JPG/PNG, then rate the provider (restaurant/caterer providers only).
- [ ] Unapproved NGO: `/ngo` shows the "awaiting approval" message (`403 NOT_VERIFIED`) and **Account** shows "Awaiting admin review".
- [ ] Sign in as a Donor (`provider@agape.demo`): lands on `/provider`; `/ngo` shows "Not available for your role". Admin: `/account` shows "Not applicable for admin accounts."
- [ ] **Sign out** clears the token and returns guarded routes to "Sign in required".
- [ ] Stop the backend: pages show a network error message, not a blank screen (the error boundary catches crashes).

## Known gaps to mention if asked
- The Donor screens (listing creation) are not built in this frontend yet.
- Role D's `ngo-reservations/api.js` still has its own request code instead of the shared `api()`.
- `/provider` (Donor) is Role C's verification stepper, not a listings screen; it is role-gated and `/auth/login`'s `landing` value maps to it. `/admin` is Role E's real admin dashboard.

## Admin and impact (Role E)
- [ ] Demo mode, **Continue as Admin**: lands on `/admin` with user and listing stat cards. The header shows Admin, Proofs, Users and Impact links; NGO and Donor see only Impact (plus their own links).
- [ ] `/admin/users`: list shows roles and verification status; activate or deactivate a user and the row updates.
- [ ] `/admin/proofs`: filter by review status; approve or reject a proof with a 1-5 star rating. A second review of the same proof is refused (`ALREADY_REVIEWED`).
- [ ] `/impact` loads without signing in and shows meals redistributed (an estimate), kg saved, and the monthly chart.
- [ ] A NGO or Donor opening `/admin`, `/admin/proofs` or `/admin/users` sees "Not available for your role".
- [ ] Live stack: `admin@agape.demo` sees real counts at `/admin`; the proof queue is empty until a proof exists. Backend: `pytest tests/admin tests/impact`.

## Verification (Role C)
- [ ] Demo mode, **Donor**: `/provider` shows the Verification page, an orange band, "Not submitted" and the two tabs. Step 2 is disabled until step 1 is approved. Submitting needs a business name, a document, a valid PAN (`ABCDE1234F`) and a 12-digit Aadhaar; bad values show inline errors.
- [ ] Demo mode, **NGO**: `/ngo/onboarding` (header link **Onboarding**) asks for a registration number and certificate.
- [ ] Demo mode, **Admin**: `/admin/verifications` (header link **Verifications**) lists requests; filter by status and type; Approve works, Reject needs a reason; **View document** opens the private file in a viewer.
- [ ] Live stack: register a restaurant donor, submit step 1 at `/provider`, then sign in as `admin@agape.demo` and approve it at `/admin/verifications`; the donor's step 2 tab unlocks. An NGO submits at `/ngo/onboarding`; approval flips `ngo_profiles.status`.
- [ ] Wrong roles see "Not available for your role". Backend: `pytest tests/verification`.
