// Donor listings API (Role B's /listings endpoints). Set VITE_USE_MOCKS=true to run without a backend.
//   GET  /listings/mine   the signed-in donor's own listings (verified donors only)
//   GET  /listings/available  open listings from the other donors (what NGOs see on the board)
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

const mockOthers = [
  { id: 901, title: 'Wedding buffet surplus', food_type: 'cooked meal', quantity: 60, unit: 'portions', est_meals: 60, est_kg: 24,
    window_start: new Date(Date.now() - 600000).toISOString(), window_end: new Date(Date.now() + 2 * 3600000).toISOString(),
    address: 'Saket, New Delhi', org_name: 'Royal Caterers', status: 'listed' },
  { id: 902, title: 'Bread and buns', food_type: 'bakery', quantity: 8, unit: 'kg', est_meals: 20, est_kg: 8,
    window_start: new Date(Date.now() - 600000).toISOString(), window_end: new Date(Date.now() + 5 * 3600000).toISOString(),
    address: 'Gurugram Sector 29', org_name: 'Neighbour Home Kitchen', status: 'listed' },
]

export const fetchMyListings = () => (USE_MOCKS ? wait(mockRows) : api('/listings/mine'))
export const fetchAvailableListings = () => (USE_MOCKS ? wait(mockOthers) : api('/listings/available'))

export function createListing(body) {
  if (!USE_MOCKS) return api('/listings', { method: 'POST', json: body })
  const est_meals = body.unit === 'portions' ? Math.round(body.quantity) : Math.round(body.quantity / 0.4)
  const est_kg = body.unit === 'kg' ? body.quantity : body.quantity * 0.4
  const row = { id: Date.now(), ...body, est_meals, est_kg, status: 'listed' }
  mockRows = [row, ...mockRows]
  return wait(row)
}
