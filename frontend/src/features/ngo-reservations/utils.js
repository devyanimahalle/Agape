export const RATEABLE_CATEGORIES = ['restaurant', 'caterer']
export const MAX_PROOF_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ALLOWED_EXT = /\.(jpe?g|png|pdf)$/i

/** "2h 15m left" / "4m 05s left" / "Window closed". `now` is epoch ms (injectable for tests). */
export function formatCountdown(endIso, now = Date.now()) {
  const ms = new Date(endIso).getTime() - now
  if (!(ms > 0)) return 'Window closed'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m left`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s left`
  return `${s}s left`
}

/** 'closed' | 'urgent' (< 30 min) | 'ok' */
export function countdownTone(endIso, now = Date.now()) {
  const ms = new Date(endIso).getTime() - now
  if (!(ms > 0)) return 'closed'
  return ms < 30 * 60 * 1000 ? 'urgent' : 'ok'
}

export function formatDistance(km) {
  if (km === null || km === undefined) return 'Distance unknown'
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

const fmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})
export function formatWindow(startIso, endIso) {
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`
}

export function formatQuantity(listing) {
  const q = Number.isInteger(listing.quantity) ? listing.quantity : Number(listing.quantity.toFixed(1))
  return `${q} ${listing.unit}`
}

export function isRateable(category) {
  return RATEABLE_CATEGORIES.includes(category)
}

/** Returns an error message, or null when the selection is acceptable. */
export function validateProofFiles(files) {
  if (!files || files.length === 0) return 'Add at least one proof (a photo or a letter).'
  for (const f of files) {
    if (!(ALLOWED_TYPES.includes(f.type) || ALLOWED_EXT.test(f.name))) {
      return `${f.name}: only PDF, JPG or PNG files are allowed.`
    }
    if (f.size > MAX_PROOF_BYTES) return `${f.name} is larger than 10 MB.`
    if (f.size === 0) return `${f.name} is empty.`
  }
  return null
}

export function osmLink(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}
