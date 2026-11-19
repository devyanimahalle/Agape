// Small line icons drawn on a 24px grid with currentColor strokes, so they take the ink or orange of their tile.
// Decorative: always aria-hidden (the text next to them carries the meaning).
function Svg({ children, className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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

// A bowl with steam: a donor lists food.
export const BowlIcon = (props) => (
  <Svg {...props}>
    <path d="M3 12h18a9 9 0 0 1-18 0Z" />
    <path d="M8 8c0-1.6 1.6-1.6 1.6-3.2M12 8c0-1.6 1.6-1.6 1.6-3.2M16 8c0-1.6 1.6-1.6 1.6-3.2" />
  </Svg>
)

// A shield with a tick: a verified NGO reserves.
export const ShieldCheckIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3l7 3v5.2c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V6l7-3Z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)

// A parcel: the pickup is confirmed.
export const ParcelIcon = (props) => (
  <Svg {...props}>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z" />
    <path d="M4 8l8 4 8-4M12 12v8" />
  </Svg>
)

// A heart: NGOs.
export const HeartIcon = (props) => (
  <Svg {...props}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Svg>
)

// A shopfront: donors.
export const StorefrontIcon = (props) => (
  <Svg {...props}>
    <path d="M4 9l1.6-5h12.8L20 9" />
    <path d="M4 9a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0A2.67 2.67 0 0 0 20 9" />
    <path d="M5 11.5V20h14v-8.5M10 20v-5h4v5" />
  </Svg>
)

// A clipboard with a tick: admins reviewing.
export const ClipboardCheckIcon = (props) => (
  <Svg {...props}>
    <path d="M9 4h6v3H9V4Z" />
    <path d="M9 5.5H7a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-2" />
    <path d="M9 14l2 2 4-4" />
  </Svg>
)
