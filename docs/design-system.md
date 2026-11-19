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
- **Wordmark:** `AGAPE` in Anton, uppercase, very large on the landing hero (`text-[5.5rem]`, `md:text-[11rem]`), always paired with the tagline **"Agape : Every Meal Matters"** in a solid `ink` pill with cream text.
- **Entry animation:** `.agape-rise` in `src/styles/index.css` (0.7s fade and 14px rise, staggered with the `--d` delay variable). Content is fully visible without it, and `prefers-reduced-motion: reduce` disables it.
- **Login:** a split layout. The left panel is `brand-bright` with the wordmark, tagline and three feature blurbs (NGO food board and reservations; donor surplus listings and admin verification, both marked "In development" because those screens are not built yet). The right panel holds the form and a `brand` submit button.

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
