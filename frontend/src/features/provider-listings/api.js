// Donor listings API (Role B's /listings endpoints). Set VITE_USE_MOCKS=true to run without a backend.
//   GET  /listings/mine   the signed-in donor's own listings (verified donors only)
//   GET  /listings/available  open listings from the other donors (what NGOs see on the board)
//   POST /listings        create a listing: title, food_type, quantity, unit, window_start, window_end,
//                         address, lat, lng, notes. The server fills est_meals and est_kg (estimates).
import { api, USE_MOCKS } from '../../lib/api'
import { DEMO, addListing, listings } from '../../lib/mockListings'

const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))

const open = (l) => l.status === 'listed' && new Date(l.window_end) > new Date()
const strip = ({ org, category, rating_avg, rating_count, ...l }) => l

// Demo mode reads the shared listings store (lib/mockListings.js): what the donor lists is on the NGO board, and a
// pickup an NGO confirms shows up here as collected.
export const fetchMyListings = () =>
  USE_MOCKS
    ? wait(listings.filter((l) => l.provider_id === DEMO.donorId).sort((a, b) => b.id - a.id).map(strip))
    : api('/listings/mine')
export const fetchAvailableListings = () =>
  USE_MOCKS
    ? wait(listings.filter((l) => l.provider_id !== DEMO.donorId && open(l)).map((l) => ({ ...strip(l), org_name: l.org })))
    : api('/listings/available')

export function createListing(body) {
  if (!USE_MOCKS) return api('/listings', { method: 'POST', json: body })
  return wait(strip(addListing(body)))
}
