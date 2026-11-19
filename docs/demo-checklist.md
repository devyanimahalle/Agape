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
- [ ] Signed out, `/` shows the landing page. **Sign in** (landing page or header) opens `/select-role` with three cards: NGO, Donor / Provider, Admin. Each card's button opens `/login?role=...`; `/login` with no role redirects to the selector. In demo mode the portal shows one **Continue as ...** button for that role only. After sign-in each role lands on its own home: NGO `/ngo`, Donor `/provider`, Admin `/admin` (unless a safe same-site `?next=` path is present for the same role, which wins).
- [ ] **Continue as Donor / Provider** opens `/provider` (Role C's verification stepper) and **Continue as Admin** opens `/admin` (Role E's admin dashboard with stat cards).
- [ ] `/login?role=ngo&next=/ngo/reservations` shows "Sign in to continue." and returns there after sign-in; `?next=//evil.com` is ignored and the role home is used. If the account's real role differs from the portal, `next` is dropped and the real role home opens with a notice.
- [ ] **Continue as NGO** goes to `/ngo`: list of nearby listings, estimated meals labelled as estimates, List/Map toggle (map tiles and markers show).
- [ ] Reserve a listing: a confirmation appears first; the card then moves to **My reservations** (`/ngo/reservations`).
- [ ] **Confirm pickup** on a reserved listing asks for one confirmation and needs NO file. It then opens `/ngo/pickups/:id/proof` (Proof of donation): upload a PDF/JPG/PNG (10 MB cap, wrong types show an error) and an optional distribution note, then **Submit proof of donation**. See "Proof of donation" below.
- [ ] Switch the header dropdown to **Donor**: `/ngo` shows "Not available for your role"; **Account** (profile menu) shows the Donor role.
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

Seed data: `python -m app.db.seed` creates ONLY the admin (`admin@agape.demo` / `Admin@123`): no NGOs, donors, listings, verification requests or proofs, so the platform starts empty and everything is registered and verified live. An existing admin is never overwritten.
- [ ] Demo login: only the Admin, `admin@agape.demo` / `Admin@123`. There are no seeded NGO or donor accounts: register them live at `/register?role=ngo` and `/register?role=provider`, then approve them at `/admin/verifications`.
- [ ] To test the unapproved path, register a second NGO through `POST /api/v1/auth/register` (it starts as `pending`).

**Walkthrough**
- [ ] No token: `/ngo` shows "Sign in required" with a **Sign in** link to the NGO portal; the header shows **Sign in** (to the role selector).
- [ ] Wrong password at `/login` shows "Email or password is incorrect."
- [ ] Register an NGO, submit its onboarding, approve it as admin, then sign in as it: redirected to `/ngo`; `localStorage['access_token']` is set; **Account** shows name, email, role and "Admin-verified".
- [ ] `/ngo` loads the real board nearest-first using the NGO's saved location (`/auth/me` `profile.lat/lng`).
- [ ] Reserve a listing: succeeds once; reserving the same listing again (second browser or user) returns the "already taken" message.
- [ ] Confirm a pickup, add proof of donation with a real PDF/JPG/PNG, then rate the provider (restaurant/caterer providers only).
- [ ] Unapproved NGO: `/ngo` shows the "awaiting approval" message (`403 NOT_VERIFIED`) and **Account** shows "Awaiting admin review".
- [ ] Sign in as a registered donor: lands on `/provider`; `/ngo` shows "Not available for your role". Admin: `/account` shows "Not applicable for admin accounts."
- [ ] **Sign out** (profile menu) clears the token, lands on `/` and returns guarded routes to "Sign in required".
- [ ] Stop the backend: pages show a network error message, not a blank screen (the error boundary catches crashes).

## Known gaps to mention if asked
- Donors can create listings at `/provider/listings`, but cannot edit or cancel them from the UI yet (the backend `PATCH /listings/{id}` and `POST /listings/{id}/cancel` exist).
- Role D's `ngo-reservations/api.js` still has its own request code instead of the shared `api()`.
- `/provider` (Donor) is Role C's verification stepper, not a listings screen; it is role-gated and `/auth/login`'s `landing` value maps to it. `/admin` is Role E's real admin dashboard.

## Admin and impact (Role E)
- [ ] Demo mode, **Continue as Admin**: lands on `/admin` with user and listing stat cards. The header shows exactly Dashboard, Verifications, Proofs, Users and Impact; NGOs and donors never see admin links.
- [ ] `/admin/users`: list shows roles and verification status; activate or deactivate a user and the row updates.
- [ ] `/admin/proofs`: filter by review status; approve or reject a proof with a 1-5 star rating. A second review of the same proof is refused (`ALREADY_REVIEWED`).
- [ ] `/impact` loads without signing in and shows meals redistributed (an estimate), kg saved, and the monthly chart.
- [ ] A NGO or Donor opening `/admin`, `/admin/proofs` or `/admin/users` sees "Not available for your role".
- [ ] Live stack: `admin@agape.demo` sees real counts at `/admin`; the proof queue is empty until a proof exists. Backend: `pytest tests/admin tests/impact`.

## Verification (Role C): one combined donor request
- [ ] Demo mode, **Donor**: `/provider` shows the orange "Verification" band, the status and two tabs. Step 2 is locked until step 1 is complete. Step 1 asks for business name, registration document, PAN (`ABCDE1234F`) and a 12-digit Aadhaar; bad values show inline errors; **Continue to step 2** sends nothing.
- [ ] Step 2 asks for the FSSAI number (14 digits) and certificate; **Submit for review** sends both steps together. Afterwards the page shows "Under review" with the PAN and Aadhaar masked (`XXXXX1234F`, `XXXX-XXXX-1098`); the full numbers are never shown.
- [ ] Demo mode, **NGO**: `/ngo/onboarding` (header link **Onboarding**) asks for a registration number and certificate.
- [ ] Demo mode, **Admin**: `/admin/verifications` lists requests; a donor request is ONE card with the business name, masked PAN and Aadhaar, FSSAI number and both "View ..." document buttons; filter by status and type (Donor / NGO); Approve works, Reject needs a reason.
- [ ] Live stack, new donor (any category, including home kitchen): register, sign in, complete both steps at `/provider`. At `/admin/verifications` (as `admin@agape.demo`) there is exactly one request for that donor with both documents. Approve it; the donor opens `/provider/listings` and the form is there.
- [ ] Live stack, new NGO: register, sign in. `/ngo` and `/ngo/reservations` show "Verification needed" and no listings; **Go to NGO onboarding**, submit; the request appears in the admin queue straight away. After approval `/ngo` shows the board (an already-open tab unlocks on reload or navigation).
- [ ] Wrong roles see "Not available for your role". Backend: `pytest tests/verification tests/auth`.

## Donor listings (`/provider/listings`)
- [ ] Demo mode, **Donor**: the header shows **Listings** and **Verification**; `/provider` has an "Open listings" card. `/provider/listings` shows the "Surplus listings" band, a "New listing" form on the left, "Your listings" on the right (two samples, each "about N (estimate)") and, below, "Open on the platform" with two other donors' listings.
- [ ] Press **List this food** with the form empty: inline errors for the name, food type, quantity and coordinates; nothing is sent. A latitude of `120` is refused.
- [ ] Fill in a name, food type, quantity (try `portions` and `kg`), keep the prefilled window and enter `28.6139` / `77.2090`: the listing appears at the top of "Your listings" as Available, with a green notice "about N meals (an estimate)". **Use my current location** fills the coordinates.
- [ ] Live stack, an approved donor: the listings it created load under "Your listings"; listings from other verified donors show under "Open on the platform"; a listing created by any verified donor appears on a verified NGO's board (`/ngo`) and in other donors' "Open on the platform". On a fresh database all of these start empty.
- [ ] Live stack, gating: a donor who is not approved (new account, pending or rejected, any category) sees "Verification needed" with a link to `/provider` and no form; `POST /api/v1/listings` and `GET /api/v1/listings/mine` return 403 `NOT_VERIFIED`.

## Admin: clean slate before a live demo (`/admin/users`)
- [ ] Each donor and NGO row has a **Delete** button (admin rows and your own row have none). It asks for confirmation, then removes the account with its requests, listings, proofs and files.
- [ ] **Reset demo accounts** (top right) asks for confirmation and deletes every donor and NGO account with all their data (requests, listings, proofs, ratings, files), keeping the admin account(s). That is the same empty state as a fresh seed, so register and verify new accounts from scratch.
- [ ] On a phone-width screen the users list is stacked cards with the same Delete button.

## Navigation and sign-in flow
- [ ] **Role selector and portals** (`/select-role`, `/login?role=...`): NGO, Donor and Admin portals have their own heading, subtitle, demo-account tile and "Switch role" link; NGO and Donor have a registration link, Admin says there is no public sign-up. Check at desktop and 390px: no horizontal scroll.
- [ ] **Wrong portal:** sign in as a registered donor through the NGO portal: you land on `/provider` and a strip says "You chose NGO, but this account is a Donor account, so we opened your Donor area."
- [ ] **Signed-in users skip the landing page:** while signed in, typing `/` in the address bar, pressing back to it, or clicking the AGAPE logo opens your role home; `/select-role` and `/login` do too. After **Sign out** the landing page is reachable again.
- [ ] **Profile menu:** the round button at the top right (your initials) opens a menu with Account and Sign out only; it closes on `Escape`, on an outside click and after choosing an item. There is no separate Account link or Sign out button in the bar.
- [ ] **Strict nav per role:** NGO: Food board, My reservations, Onboarding, Impact. Donor: Verification, Listings, Impact. Admin: Dashboard, Verifications, Proofs, Users, Impact. Signed out: Impact and Sign in.
- [ ] **Registration** (live stack): `/register?role=ngo` or `?role=provider` creates the account, signs it in and lands on its home (an unverified NGO or donor sees the verification gate). In demo mode the page points to the portal instead.

## Proof of donation (NGO pickup, step by step)
- [ ] `/ngo/reservations`, a reserved card: the buttons are **Confirm pickup** and **Cancel reservation**. **Confirm pickup** opens a dialog ("You will add proof of donation next") with no file field; confirming marks the pickup collected in one click and goes straight to the Proof of donation page.
- [ ] The Proof of donation page (orange band, one white form card) shows "Pickup confirmed. Now add proof that the food was donated.", the file field (geotagged distribution photo, signed distribution or beneficiary sheet, or receipt; PDF/JPG/PNG up to 10 MB each, several files allowed, each removable), an optional distribution note, **Submit proof of donation** and **Do this later**.
- [ ] After submitting you land on `/ngo/reservations` with a notice; the card shows "Proof of donation: Awaiting admin review". If you chose **Do this later**, the collected card shows "Proof of donation: Needed" and an **Upload proof of donation** link back to the page, at any time. "Add more files" appears while it is waiting for review; after a rejection the card says "Not approved, upload again"; once approved there is nothing more to upload.
- [ ] Admin, `/admin/proofs`: one card per uploaded file ("Proof of donation #N") with the listing, donor, NGO and the **distribution note**. **View proof of donation** opens the file in a viewer with **Open in new tab** and **Download**. Approve (with a star rating) or reject. Live stack: only admins can open the files (`GET /api/v1/admin/documents/{id}`).
- [ ] Demo mode works the same way, in one browser session: confirm a pickup as an NGO, upload a file, switch the header role to Admin and open Proofs: the NGO's proof of donation is there and its file opens. (Demo data lives in memory, so use the in-app links rather than reloading the page between steps.)
- [ ] Backend: `pytest tests/proofs`.

## Admin overview pending counts
- [ ] `/admin` (Dashboard) shows **Pending NGOs** and **Pending donors**. Demo mode starts at 1 and 1. In `/admin/verifications`, **Approve** (or Reject with a reason) each pending request, then open **Dashboard**: both read **0**. The accounts read as verified on `/admin/users`.
- [ ] Demo mode: as **NGO**, submit **Onboarding**; as **Admin**, Dashboard shows Pending NGOs 1; approve it in Verifications and it returns to 0. Same for a donor's verification at `/provider`.
- [ ] A newly registered NGO or donor that has NOT submitted anything is not counted; it appears as soon as it submits. An approved account is never counted.
- [ ] Deleting a pending account on `/admin/users`, or **Reset demo accounts**, lowers the counts at once (reset: 0 and 0, Total users 1).
- [ ] Live stack: leave the Dashboard open, submit a request from another browser, then click back into the tab: the number updates without a reload. Backend: `pytest tests/admin/test_pending_counts.py`.

