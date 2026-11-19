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
| `primary` | `#ffd600` | Agape primary yellow, main CTAs and key highlights |
| `highlight` | `#f4f46e` | Soft banner / marquee accent (Stacked's lime-yellow) |
| `plum` / `plum-mid` | `#3d1a39` / `#a54d85` | Dark variant, secondary accent |
| `toast` | `#3b404b` | Toast / notification surface |

Rules: yellow is a *surface* behind black text, never text on light backgrounds. Reserve `primary` for CTAs.

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
