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
- [ ] `/` landing page loads: "Surplus food, collected in time", the three steps, the "what we check, and what we don't claim" section, and role cards (Donor and Admin marked "In development").
- [ ] Header shows a **Demo mode** badge and a role dropdown (Donor / NGO / Admin).
- [ ] `/login` shows the form plus **Continue as NGO / Donor / Admin** buttons.
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
- [ ] Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}`; `/docs` lists the auth routes and `/api/v1/board`
- [ ] Frontend: set `VITE_USE_MOCKS=false` in `frontend/.env`, restart `npm run dev`
- [ ] Backend tests: Role B's suite and Role D's `pytest tests/reservations` (needs PostgreSQL via `TEST_DATABASE_URL`)

Seed data (an admin, one approved NGO with `lat`/`lng`, a provider, and an available listing near the NGO)
- [ ] Register or seed the users through `POST /api/v1/auth/register`; approve the NGO (`status = approved`)

**Walkthrough**
- [ ] No token: `/ngo` shows "Sign in required" with a **Sign in** link; header shows **Sign in**.
- [ ] Wrong password at `/login` shows "Email or password is incorrect."
- [ ] Sign in as the approved NGO: redirected to `/ngo`; `localStorage['access_token']` is set; **Account** shows name, email, role and "Admin-verified".
- [ ] `/ngo` loads the real board nearest-first using the NGO's saved location (`/auth/me` `profile.lat/lng`).
- [ ] Reserve a listing: succeeds once; reserving the same listing again (second browser or user) returns the "already taken" message.
- [ ] Complete pickup with a real PDF/JPG/PNG, then rate the provider (restaurant/caterer providers only).
- [ ] Unapproved NGO: `/ngo` shows the "awaiting approval" message (`403 NOT_VERIFIED`) and **Account** shows "Awaiting admin review".
- [ ] Sign in as a Donor: `/ngo` shows "Not available for your role". Admin: `/account` shows "Not applicable for admin accounts."
- [ ] **Sign out** clears the token and returns guarded routes to "Sign in required".
- [ ] Stop the backend: pages show a network error message, not a blank screen (the error boundary catches crashes).

## Known gaps to mention if asked
- Donor and Admin screens (listing creation, NGO review) are not built in this frontend yet.
- Role D's `ngo-reservations/api.js` still has its own request code instead of the shared `api()`.
- `/provider` and `/admin` landing paths returned by `/auth/login` have no pages yet; the app redirects non-NGOs to `/`.
