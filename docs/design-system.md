# Agape Design System

Adapted from The Stacked Store (stackedstore.com), extracted with `npx design-bites add stackedstore.com` (Sparkbites).
We take the *palette, rhythm and component cues* only. No brand assets, copy or imagery are reused.
Tokens live in `frontend/src/styles/index.css` (`@theme`).

## Palette
| Token | Value | Use |
|---|---|---|
| `canvas` | `#f5f0e4` | Page background (warm parchment, never cold white) |
| `panel` | `#ffffff` | Cards, dialogs |
| `ink` | `#111111` | Text, solid buttons |
| `muted` | `#5b564b` | Secondary text (darkened from source for AA contrast) |
| `line` | `#a89f91` | All borders and inputs, `1px solid` |
| `sage` | `#889387` | Hero / section surface |
| `primary` | `#ffd600` | Agape primary yellow, secondary CTAs and key highlights |
| `brand-bright` | `#f97316` | Warm orange brand surface (landing hero, login brand panel, primary `brand` button, header underline). Dark `ink` text on it is about 6.8:1 |
| `brand` | `#ea580c` | Deeper orange for hover states and display-size accents. Dark `ink` text on it is about 4.5:1 |
| `brand-deep` | `#9a3412` | Orange used as TEXT on cream or white (about 7:1) |
| `highlight` | `#f4f46e` | Soft banner / marquee accent (Stacked's lime-yellow) |
| `plum` / `plum-mid` | `#3d1a39` / `#a54d85` | Dark variant, secondary accent |
| `toast` | `#3b404b` | Toast / notification surface |

Rules: yellow and orange are *surfaces* behind dark `ink` text. Never use white text on orange (about 3.6:1), and never use yellow as text on light backgrounds. Orange text on cream is allowed only at display size (24px and up) with `brand`, or at any size with `brand-deep`.

## Brand moments
- **Wordmark:** `AGAPE` in Anton, uppercase. In the landing hero it is the page's `h1`, sized `clamp(4.5rem,10vw,8rem)` (about 128px on desktop, 72px on a phone), with the tagline **"Every MEAL Matters"** in a solid `ink` pill with cream text directly under it. It is large and orange on ink in the footer and viewport-scaled on the login panel (`clamp(4.5rem,15vw,9.5rem)`).
- **Entry animation:** `.agape-rise` in `src/styles/index.css` (0.7s fade and 14px rise, staggered with the `--d` delay variable). Content is fully visible without it, and `prefers-reduced-motion: reduce` disables it.
- **Login:** a split layout. The left panel is `brand-bright` with the wordmark, tagline and three feature blurbs (NGO food board and reservations; verified donor listings; admin verification with honest claims). All three roles are live, so nothing is marked "In development". The right panel holds the form and a `brand` submit button.

## Typography
- Display (h1-h3): uppercase, no rounded treatment. Source uses FKScreamer (commercial), so we use **Anton** (Google Fonts, SIL OFL).
- Body / UI: source uses ABCWhyteSemi-Mono (commercial), so we use **DM Mono** (Google Fonts, SIL OFL). Do not mix other faces in body copy.
- Scale: h1 60/72, h2 28, body 14, buttons 14 / weight 700 / uppercase / 1px tracking, labels weight 600.

## Shape, spacing, depth
- Radii: `10px` cards (`rounded-card`), `999px` pills/chips (`rounded-pill`). No rounding on display headings.
- Spacing: 2rem page padding, 1.4rem box/button padding, 30px footer gutters.
- No shadows. Depth comes from layering canvas, white panels and dark overlays.
- Buttons: solid black with tan border (default), electric yellow full-width for the primary CTA, transparent ghost for nav.

## Honest UI copy rules
Use these exact claims. Do not overstate.
| Topic | Say | Never say |
|---|---|---|
| NGOs | "Admin-verified NGOs" | "Fully vetted", "guaranteed legitimate" |
| FSSAI | "FSSAI number format check plus admin review" | "FSSAI verified", "FSSAI certified" |
| Documents | "Documents are stored privately" | "Bank-grade security", "encrypted" (unless true) |
| Impact | "Estimated meals" / "≈ 50 meals (estimate)" | Unqualified meal counts, invented totals |
| General | Real numbers from our data only | Made-up stats, testimonials, partner logos |

Keep the word "estimate/estimated" visible next to every meal-impact figure.

## Compatibility with `origin/branch-d` (ngo-reservations)
- Uses plain elements + Tailwind classes and `import.meta.env.VITE_API_BASE` / `VITE_USE_MOCKS`. Both are supported by the scaffold (`.env.example`).
- Needs `leaflet` + `react-leaflet@5` on React 19 (installed) and Vitest with jsdom + jest-dom matchers (`src/test/setup.js`).
- Leaflet marker images are resolved by its own `leafletSetup.js`. No extra Vite config is needed.

## Page frame and shared states (enforced across every route)
- **One frame:** every routed screen is built with `components/Page` (`<Page title subtitle width>`): the orange `PageHeader` band, then content on cream in `mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20` (narrower `width` for forms: `max-w-2xl` to `max-w-4xl`). That includes the sign-in-required, not-available-for-your-role, not-found and error screens. No heading may float on bare canvas. Only the landing page (`/`) and the login split layout (`/login`) are bespoke brand moments.
- **Band:** `bg-brand-bright` with `ink` text, one `h1` per page (Anton, `clamp(3.5rem,11vw,8rem)`), an optional one-to-two-line subtitle in DM Mono, and a minimum height of `21rem` from `md` up so the bands line up when you move between pages. Subtitles are plain text, not pills.
- **Two card scales:** panel cards `p-7 md:p-9` with an `h2` at `text-3xl md:text-4xl`; item cards (one listing, one proof, one request) `p-6` with an `h3` at `text-2xl md:text-3xl`. Inner detail tiles are `rounded-[6px] bg-canvas px-4 py-3` with an uppercase `text-xs` label.
- **Forms:** labels are `text-xs font-semibold uppercase tracking-[1px]`; fields are `mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3` and turn white on focus; inline errors are `text-xs text-bad-ink`; server errors are a `role="alert"` block on `bg-bad-bg`; confirmations are a `role="status"` block on `bg-ok-bg`.
- **States:** `LoadingState` and `EmptyState` are borderless white `rounded-card` surfaces (no dashed outlines). Dialogs are white `rounded-card` panels on the `toast` backdrop.
- **Header navigation is strictly role-based, with no cross-role links:** signed-out visitors see Impact and a Sign in button (to the role selector); NGOs see Food board, My reservations, Onboarding, Impact; donors see Verification, Listings, Impact; admins see Dashboard, Verifications, Proofs, Users, Impact. Signed-in users also get a round profile button (initials, `brand-bright`, `aria-label="Profile menu"`) in the top-right corner that opens a small white menu with exactly **Account** and **Sign out**; it closes on outside click, `Escape` or a choice, and supports the arrow keys. There is no standalone Account link or Sign out button in the bar. The AGAPE logo links to the role home when signed in and to `/` when signed out. The nav wraps on narrow screens instead of scrolling sideways. The active link is `brand-bright` with ink text; every control uses the global `3px` ink focus ring (orange on dark surfaces).
- **Responsive:** every route is checked at 1280px and 390px with no horizontal page scroll. Wide data (the admin users table) switches to stacked cards below `md` rather than scrolling sideways.
- **Glyphs:** no emoji or icon characters. The `★` in the rating controls is the one text glyph, and it always sits next to a number or an accessible label. Audit greps: `shadow`, `border-l-`, `rounded-lg|xl|md`, Tailwind colour scales (`gray-`, `blue-`, ...), `text-white`, `style=`, emoji and stray backslash escapes should return nothing outside tests and `leafletSetup.js`.

## Entry flow: landing, role selector, role portals
- `/` is the public landing page and is for signed-out visitors only. A signed-in user who opens `/` (URL, back button or the logo) is redirected to the home of their role (`/ngo`, `/provider`, `/admin`); they reach `/` again only after signing out.
- **Sign in** (landing page and header) goes to `/select-role`: a `Page` with three white cards (NGO, Donor / Provider, Admin), each with an Anton title, a description and a `brand` button "Sign in as ...". NGO and donor cards add a "Register ..." link; the admin card never does.
- `/login?role=ngo|provider|admin` is the portal for one role: the split login layout with a role heading ("NGO sign in", "Donor sign in", "Admin sign in"), a role subtitle, the role's feature blurb on the orange panel, a "Demo account" tile, a registration link (not for admins) and a **Switch role** link back to the selector. `/login` without a valid role redirects to the selector, keeping a safe `?next=`.
- After sign-in the account goes to its real role home. If it signed in through the wrong portal, `?next=` is dropped and a short notice on a `highlight` strip says which area opened. `/register?role=ngo|provider` is the self-registration form (admins are never self-registered).

## Motion and hover
- **Active nav link:** the current route (`aria-current="page"`, set by `NavLink`) is drawn as a 3px `brand-bright` underline under the link (`.nav-link` in `styles/index.css`); there is no filled pill. Hovering any other link turns its text orange and previews a short underline. Only the signed-in role's own links exist, so only they can be underlined.
- **Buttons and cards:** every `.press` control lifts 2px on hover and presses in on click. An `<article>` card (one listing, request or role) lifts 3px with the `translate` property; form panels and other cards stay still. Fields ease between the cream and white fills. No shadows, glows or emoji.
- **Cursor dot:** `components/CursorDot` draws a 14px `#F97316` dot with a thin ink ring (so it stays visible on the orange bands) that trails the mouse with `requestAnimationFrame` easing, grows over links, buttons and fields, and shrinks while pressed. It is `aria-hidden`, `pointer-events: none`, never rendered for coarse or non-hovering pointers (`@media (hover: none), (pointer: coarse)`, so none on touch or at phone widths on a phone) and never under `prefers-reduced-motion: reduce`, which also switches off the nav underline animation and card lift.
- **Landing hero:** a two-column band on `brand-bright`. Left: the `AGAPE` mark, the `Every MEAL Matters` pill, the Option A paragraph and exactly two actions on one row (solid ink **Sign in**, solid cream **How it works**, 56px tall). Right (stacked below on phones): the pickup-window visual, an `ink` card with three stages, Listed, Reserved and Collected, that light up in turn in `brand-bright` (`.pickup-stage`, 3s each) over a window bar that fills (`.pickup-fill`), labelled "Sample" and showing no figures. Flat tokens only (no photography, no shadows); static with the first stage lit under `prefers-reduced-motion: reduce`.

## Landing cards: icons, no buttons
- **Icons:** `components/icons.jsx` holds small line icons on a 24px grid (`currentColor` strokes, 1.75px, round caps, `aria-hidden`). They sit in a 48px (56px from `md`) `ink` tile with an `brand-bright` stroke (`IconTile` on the landing page). Hovering the card flips the tile to orange with an ink icon and pops it 6% (`.icon-tile`, off under reduced motion); on the orange NGO card the tile flips to cream instead.
- **How it works:** each step card is an icon tile beside the Anton title and the description: a bowl (donors list food), a shield with a tick (verified NGOs reserve) and a parcel (pickup confirmed).
- **Who it is for:** NGO (heart), Donor (shopfront) and Admin (clipboard with a tick) cards hold an icon, the role name and one description, and nothing else: no Open buttons, because those workspaces are reached after signing in. The cards are equal height and lift on hover.
