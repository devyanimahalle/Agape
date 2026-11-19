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

## Role B (auth, per `backend/app/reservations/deps.py`)
- Provide `current_user` returning an object with `.id` and `.role`, and `GET /auth/me` returning `{ id, role, name, profile: { lat, lng } }`.
- Frontend: add `features/auth/` with login/register pages and call `setToken()` after login. Role A adds `/login` and `/register` routes and redirects guarded routes there.

## Role C
Scope to be confirmed. Follow the same pattern: `features/<name>/`, `backend/app/<name>/`, a short README, and a request to Role A for routes and roles.

## Role D (already merged)
`/ngo` and `/ngo/reservations` are routed and role-guarded. To switch from mocks to the real backend: set `VITE_USE_MOCKS=false`, mount `backend/app/reservations` router at `/api/v1`, and ensure `/auth/me` exists. Optional follow-up: have `ngo-reservations/api.js` use the shared `api()`.

## Copy rules
Use the wording in `design-system.md`. Never write "FSSAI verified" or invent statistics.
