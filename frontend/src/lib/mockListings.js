// Demo-mode store for listings, shared by everything that reads or changes them: the NGO board and reservations, the
// donor's listings page, the admin overview and the Impact page. A listing created by the demo donor is on the NGO
// board; a pickup the demo NGO confirms is the pickup Impact counts. Dev/demo use only.
const hours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString()
const days = (d) => hours(-24 * d)

export const DEMO = { ngoId: 10, donorId: 'mock-provider' }
export const NGO_NAMES = { 3: 'Feed the Hungry', 4: 'Hope Foundation', 10: 'Asha Foundation' }

const base = (o) => ({
  provider_id: 1, food_type: 'cooked', unit: 'kg', est_meals: 0, est_kg: 0, notes: null, status: 'listed',
  reserved_by_ngo_id: null, reserved_at: null, completed_at: null, created_at: hours(-1), window_start: hours(-0.5), ...o,
})

// Collected pickups (history). Meals and kg are the same kind of estimate the backend records from the quantity.
const collected = (o) => base({ status: 'completed', window_start: days(o.ago + 0.2), window_end: days(o.ago + 0.1), reserved_at: days(o.ago + 0.1), completed_at: days(o.ago), created_at: days(o.ago + 0.5), ...o })

export const listings = [
  base({ id: 1, title: 'Veg biryani', quantity: 20, est_meals: 50, est_kg: 20, window_end: hours(3), address: 'Karol Bagh, Delhi', lat: 28.6517, lng: 77.1907, org: 'Spice Route', category: 'restaurant', rating_avg: 4.6, rating_count: 12 }),
  base({ id: 2, title: 'Wedding buffet surplus', quantity: 60, unit: 'portions', est_meals: 60, est_kg: 24, window_end: hours(0.4), address: 'Saket, Delhi', lat: 28.5245, lng: 77.2066, org: 'Royal Caterers', category: 'caterer', rating_avg: 4.1, rating_count: 5 }),
  base({ id: 3, title: 'Bread and buns', quantity: 8, est_meals: 20, est_kg: 8, window_end: hours(5), address: 'Gurugram Sector 29', lat: 28.4595, lng: 77.0266, org: 'Neighbour Home Kitchen', category: 'general', rating_avg: null, rating_count: 0 }),
  base({ id: 4, title: 'Dal and rice', quantity: 15, est_meals: 38, est_kg: 15, window_end: hours(2), address: 'Noida Sector 18', lat: 28.5708, lng: 77.3261, org: 'Spice Route', category: 'restaurant', rating_avg: 4.6, rating_count: 12 }),
  // the demo donor's own open listing
  base({ id: 5, title: 'Dal and rice, 40 portions', provider_id: DEMO.donorId, quantity: 40, unit: 'portions', est_meals: 40, est_kg: 16, window_end: hours(4), address: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295, org: 'Demo Kitchen', category: 'restaurant', rating_avg: null, rating_count: 0 }),
  // history: pickups already collected (ids match the demo proofs in lib/mockProofs.js)
  collected({ id: 10, ago: 3, title: '20kg Basmati Rice', provider_id: 2, food_type: 'Grains', quantity: 20, est_meals: 50, est_kg: 20, reserved_by_ngo_id: 3, address: 'Khan Market, Delhi', org: 'Fresh Kitchen', category: 'restaurant', rating_avg: 4.5, rating_count: 2 }),
  collected({ id: 11, ago: 9, title: '50 Meal Portions', provider_id: 2, food_type: 'Cooked Food', unit: 'portions', quantity: 50, est_meals: 50, est_kg: 20, reserved_by_ngo_id: 3, address: 'Khan Market, Delhi', org: 'Fresh Kitchen', category: 'restaurant', rating_avg: 4.5, rating_count: 2 }),
  collected({ id: 12, ago: 40, title: '10kg Vegetables', provider_id: 105, food_type: 'Vegetables', quantity: 10, est_meals: 25, est_kg: 10, reserved_by_ngo_id: 4, address: 'Lajpat Nagar, Delhi', org: 'City Caterers', category: 'caterer', rating_avg: 4.2, rating_count: 3 }),
  collected({ id: 13, ago: 2, title: 'Roti and sabzi', provider_id: 106, food_type: 'cooked', quantity: 8, est_meals: 20, est_kg: 8, reserved_by_ngo_id: DEMO.ngoId, address: 'Gurugram Sector 29', org: 'Neighbour Home Kitchen', category: 'general', rating_avg: null, rating_count: 0 }),
  collected({ id: 14, ago: 6, title: 'Poha, 30 portions', provider_id: DEMO.donorId, food_type: 'cooked', unit: 'portions', quantity: 30, est_meals: 30, est_kg: 12, reserved_by_ngo_id: 3, address: 'India Gate, New Delhi', org: 'Demo Kitchen', category: 'restaurant', rating_avg: null, rating_count: 0 }),
  base({ id: 20, title: 'Samosas', status: 'cancelled', quantity: 5, est_meals: 12, est_kg: 5, window_end: hours(-2), org: 'Spice Route', category: 'restaurant', rating_avg: 4.6, rating_count: 12 }),
  base({ id: 21, title: 'Fruit boxes', status: 'expired', quantity: 6, est_meals: 15, est_kg: 6, window_end: hours(-6), org: 'Royal Caterers', category: 'caterer', rating_avg: 4.1, rating_count: 5 }),
]

let nextId = 200

// Same estimate rule as the backend: 0.4 kg per meal, one portion is one meal.
export function estimateFor(quantity, unit) {
  return unit === 'kg' ? { est_meals: Math.round(quantity / 0.4), est_kg: quantity } : { est_meals: Math.round(quantity), est_kg: Math.round(quantity * 0.4 * 100) / 100 }
}

export function addListing(body) {
  const listing = base({
    id: nextId++, provider_id: DEMO.donorId, org: 'Demo Kitchen', category: 'restaurant', rating_avg: null, rating_count: 0,
    ...body, ...estimateFor(body.quantity, body.unit), status: 'listed', created_at: new Date().toISOString(),
  })
  listings.push(listing)
  return listing
}

// An account was deleted: its listings go; listings an NGO had reserved from someone else are released (cancelled).
export function removeListingsFor(accountId) {
  for (let i = listings.length - 1; i >= 0; i--) if (listings[i].provider_id === accountId) listings.splice(i, 1)
  for (const l of listings) {
    if (l.reserved_by_ngo_id === accountId) Object.assign(l, { status: 'cancelled', reserved_by_ngo_id: null })
  }
}

export function clearMockListings() {
  listings.length = 0
}
