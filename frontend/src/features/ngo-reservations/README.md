# ngo-reservations (Role D, frontend)

Default-exported pages for Role A to route: `NgoBoardPage` (`/ngo`) and `NgoReservationsPage` (`/ngo/reservations`)
(also re-exported from `index.js`).

* **Board**: cards sorted nearest first (order comes from the API) with distance, quantity, estimated meals/kg (labelled
  "estimate"), live collection-window countdown, provider rating (hidden when `rating_avg` is null). List/Map toggle
  (Leaflet + OpenStreetMap markers with a Reserve button in each popup). Reserve always asks for confirmation; a `409`
  explains the listing was taken and refreshes. Refreshes every 30 s. `403 NOT_VERIFIED` shows an "awaiting approval" message.
* **Location**: starts from the NGO's saved location (`/auth/me` → `profile.lat/lng`). "Change location" lets them search an
  address (only when **Search** is pressed, never per keystroke) or drag the pin / click the map, then re-sorts the board.
* **My reservations**: tabs (All / To collect / Completed), cancel with confirmation, **Complete pickup** dialog (at least
  one PDF/JPG/PNG proof, 10 MB cap, optional note, validated client-side and by the server), then a **Rate provider**
  dialog for restaurant/caterer providers. Rating once per listing (`ALREADY_RATED` is treated as done).
* **Mock mode**: `VITE_USE_MOCKS=true` serves in-memory data shaped exactly like the contract (`mockApi.js`).
* **API seam**: `api.js` is the only file that talks to the backend (token read from `localStorage['access_token']`; swap
  `request()` for Role A's shared client when it lands). Pages use plain elements + Tailwind classes until the design
  system lands; no global CSS (only Leaflet's own stylesheet is imported).
* **Dependencies added**: `leaflet`, `react-leaflet` (v5, React 19).

## Tests
`npx vitest run` — 45 tests (utils, API layer, cards, board flows, reservations flows, map, mock API). Also smoke-tested in
Chromium with real Leaflet (markers, popup reserve, draggable pin, no runtime errors).
