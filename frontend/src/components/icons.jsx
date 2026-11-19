// Line icons for the landing cards. One construction rule for all of them: a 24 x 24 grid, whole-number coordinates,
// a 2px stroke with round caps and joins, and plain primitives (rect, line, path). They take the colour of their
// tile through currentColor (orange on ink, ink on orange). Decorative: always aria-hidden.
function Svg({ children, className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

// Donors list food: a bowl with three steam lines.
export const BowlIcon = (props) => (
  <Svg {...props}>
    <line x1="3" y1="11" x2="21" y2="11" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="9" y1="3" x2="9" y2="7" />
    <line x1="12" y1="3" x2="12" y2="7" />
    <line x1="15" y1="3" x2="15" y2="7" />
  </Svg>
)

// Verified NGOs reserve: a shield with a tick.
export const ShieldCheckIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)

// Pickup is confirmed: a parcel, drawn as a cube.
export const ParcelIcon = (props) => (
  <Svg {...props}>
    <path d="M12 2l9 5v10l-9 5-9-5V7l9-5Z" />
    <path d="M3 7l9 5 9-5" />
    <line x1="12" y1="12" x2="12" y2="22" />
  </Svg>
)

// NGOs: a heart made of two round lobes and a point.
export const HeartIcon = (props) => (
  <Svg {...props}>
    <path d="M4 9a4 4 0 0 1 8 0 4 4 0 0 1 8 0c0 5-4 9-8 12-4-3-8-7-8-12Z" />
  </Svg>
)

// Donors: a shopfront with an awning and a door.
export const StorefrontIcon = (props) => (
  <Svg {...props}>
    <path d="M4 4h16l2 6H2l2-6Z" />
    <path d="M4 10v10h16V10" />
    <path d="M10 20v-5h4v5" />
  </Svg>
)

// Admins: a clipboard with a tick.
export const ClipboardCheckIcon = (props) => (
  <Svg {...props}>
    <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" />
  </Svg>
)
