// Donor listings API (Role B's /listings endpoints). Set VITE_USE_MOCKS=true to run without a backend.
//   GET  /listings/mine   the signed-in donor's own listings (verified donors only)
//   POST /listings        create a listing: title, food_type, quantity, unit, window_start, window_end,
//                         address, lat, lng, notes. The server fills est_meals and est_kg (estimates).
import { api, USE_MOCKS } from '../../lib/api'

const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))

// Same estimate rule as the backend (backend/app/listings/service.py): 0.4 kg per meal, 1 portion = 1 meal.
let mockRows = [
  { id: 1, title: 'Dal and rice, 40 portions', food_type: 'cooked meal', quantity: 40, unit: 'portions', est_meals: 40, est_kg: 16,
    window_start: new Date(Date.now() - 900000).toISOString(), window_end: new Date(Date.now() + 4 * 3600000).toISOString(),
    address: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295, notes: null, status: 'listed' },
  { id: 2, title: 'Vegetable biryani, 25 portions', food_type: 'cooked meal', quantity: 25, unit: 'portions', est_meals: 25, est_kg: 10,
    window_start: new Date(Date.now() - 7 * 3600000).toISOString(), window_end: new Date(Date.now() - 3600000).toISOString(),
    address: 'Lajpat Nagar, New Delhi', lat: 28.5535, lng: 77.2588, notes: null, status: 'completed' },
]

export const fetchMyListings = () => (USE_MOCKS ? wait(mockRows) : api('/listings/mine'))

export function createListing(body) {
  if (!USE_MOCKS) return api('/listings', { method: 'POST', json: body })
  const est_meals = body.unit === 'portions' ? Math.round(body.quantity) : Math.round(body.quantity / 0.4)
  const est_kg = body.unit === 'kg' ? body.quantity : body.quantity * 0.4
  const row = { id: Date.now(), ...body, est_meals, est_kg, status: 'listed' }
  mockRows = [row, ...mockRows]
  return wait(row)
}
