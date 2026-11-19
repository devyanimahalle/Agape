// In-memory stand-in for the backend, shaped exactly like the contract. Dev/demo use only.
import { addMockProof, mockProofSummary } from '../../lib/mockProofs'

const hours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString()
const err = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail })
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))

const ME = {
  user: { id: 10, email: 'ngo1@shareplate.demo', role: 'ngo', name: 'Asha Foundation' },
  profile: { user_id: 10, org_name: 'Asha Foundation', address: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, status: 'approved' },
  verification_status: 'approved',
}

const base = (o) => ({
  provider_id: 1, food_type: 'cooked', unit: 'kg', est_meals: 0, est_kg: 0, notes: null, status: 'listed',
  reserved_by_ngo_id: null, reserved_at: null, completed_at: null, created_at: hours(-1),
  window_start: hours(-0.5), ...o,
})
let listings = [
  base({ id: 1, title: 'Veg biryani', quantity: 20, est_meals: 50, est_kg: 20, window_end: hours(3), address: 'Karol Bagh, Delhi', lat: 28.6517, lng: 77.1907, org: 'Spice Route', category: 'restaurant', rating_avg: 4.6, rating_count: 12 }),
  base({ id: 2, title: 'Wedding buffet surplus', quantity: 60, unit: 'portions', est_meals: 60, est_kg: 24, window_end: hours(0.4), address: 'Saket, Delhi', lat: 28.5245, lng: 77.2066, org: 'Royal Caterers', category: 'caterer', rating_avg: 4.1, rating_count: 5 }),
  base({ id: 3, title: 'Bread and buns', quantity: 8, est_meals: 20, est_kg: 8, window_end: hours(5), address: 'Gurugram Sector 29', lat: 28.4595, lng: 77.0266, org: 'Neighbour Home Kitchen', category: 'general', rating_avg: null, rating_count: 0 }),
  base({ id: 4, title: 'Dal and rice', quantity: 15, est_meals: 38, est_kg: 15, window_end: hours(2), address: 'Noida Sector 18', lat: 28.5708, lng: 77.3261, org: 'Spice Route', category: 'restaurant', rating_avg: 4.6, rating_count: 12 }),
]
const mine = new Set()
const rated = new Set()

function haversine(a, b, c, d) {
  const r = (x) => (x * Math.PI) / 180
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h))
}
const strip = ({ org, category, rating_avg, rating_count, ...l }) => l

export const getMe = () => wait(ME)
export const geocode = (q) =>
  wait([
    { label: `${q}, New Delhi, Delhi, India`, lat: 28.6139, lng: 77.209 },
    { label: `${q}, Gurugram, Haryana, India`, lat: 28.4595, lng: 77.0266 },
  ])

export function getBoard(lat, lng) {
  const rows = listings
    .filter((l) => l.status === 'listed' && new Date(l.window_end) > new Date())
    .map((l) => ({
      ...strip(l), distance_km: Math.round(haversine(lat, lng, l.lat, l.lng) * 100) / 100,
      org_name: l.org, provider_category: l.category,
      rating_avg: l.category === 'general' ? null : l.rating_avg, rating_count: l.rating_count,
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
  return wait(rows)
}

export function reserve(id) {
  const l = listings.find((x) => x.id === id)
  if (!l) return Promise.reject(err(404, 'NOT_FOUND', 'Listing not found'))
  if (l.status !== 'listed') return Promise.reject(err(409, 'ALREADY_RESERVED', 'This listing is no longer available'))
  Object.assign(l, { status: 'reserved', reserved_by_ngo_id: ME.user.id, reserved_at: new Date().toISOString() })
  mine.add(id)
  return wait(strip(l))
}

export function cancelReservation(id) {
  const l = listings.find((x) => x.id === id)
  if (!l || l.status !== 'reserved') return Promise.reject(err(409, 'INVALID_STATE', 'Only a reserved listing can be cancelled'))
  const open = new Date(l.window_end) > new Date()
  Object.assign(l, { status: open ? 'listed' : 'expired', reserved_by_ngo_id: null, reserved_at: null })
  mine.delete(id)
  return wait(strip(l))
}

export function completePickup(id) {
  const l = listings.find((x) => x.id === id)
  if (!l || l.status !== 'reserved') return Promise.reject(err(409, 'INVALID_STATE', 'Only a reserved listing can be completed'))
  Object.assign(l, { status: 'completed', completed_at: new Date().toISOString() })
  return wait(strip(l))
}

export function submitProof(id, files, note) {
  const l = listings.find((x) => x.id === id)
  if (!l || !mine.has(id)) return Promise.reject(err(404, 'NOT_FOUND', 'Listing not found'))
  if (l.status !== 'completed') return Promise.reject(err(409, 'INVALID_STATE', 'Confirm the pickup before uploading proof of donation'))
  if (!files?.length) return Promise.reject(err(400, 'PROOF_REQUIRED', 'Upload at least one proof of donation'))
  if (mockProofSummary(id).status === 'approved') return Promise.reject(err(409, 'PROOF_ALREADY_APPROVED', 'The proof of donation for this pickup was already approved'))
  files.forEach((file) => addMockProof({ listing: l, providerOrg: l.org, ngoId: ME.user.id, ngoOrg: ME.profile.org_name, note, file }))
  const { status, count } = mockProofSummary(id)
  return wait({ listing_id: id, added: files.length, proof_status: status, proof_count: count })
}

export function getReservations(status) {
  const rows = listings
    .filter((l) => mine.has(l.id) && (!status || l.status === status))
    .map((l) => ({ ...strip(l), org_name: l.org, provider_category: l.category, has_rated: rated.has(l.id), proof_status: mockProofSummary(l.id).status, proof_count: mockProofSummary(l.id).count }))
  return wait(rows)
}

export function rateProvider(id, { stars, comment }) {
  const l = listings.find((x) => x.id === id)
  if (rated.has(id)) return Promise.reject(err(409, 'ALREADY_RATED', 'You have already rated this pickup'))
  if (l?.category === 'general') return Promise.reject(err(400, 'NOT_RATEABLE', 'This provider is not rated'))
  rated.add(id)
  return wait({ listing_id: id, stars, comment: comment ?? null, provider_rating_avg: stars, provider_rating_count: 1 })
}
