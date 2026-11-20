const hours = (h) => new Date(Date.now() + h * 3600e3).toISOString()
export const boardItem = (o = {}) => ({
  id: 1, provider_id: 1, title: 'Veg biryani', food_type: 'cooked', quantity: 20, unit: 'kg', est_meals: 50, est_kg: 20,
  window_start: hours(-1), window_end: hours(3), address: 'Karol Bagh', lat: 28.65, lng: 77.19, notes: null, status: 'listed',
  reserved_by_ngo_id: null, reserved_at: null, completed_at: null, created_at: hours(-2),
  distance_km: 2.5, org_name: 'Spice Route', rating_avg: 4.5, rating_count: 3, provider_category: 'restaurant', ...o,
})
export const reservation = (o = {}) => ({
  ...boardItem(), status: 'reserved', reserved_by_ngo_id: 10, reserved_at: hours(-0.1), has_rated: false, ...o,
})
export const ME = {
  user: { id: 10, role: 'ngo', name: 'Asha' },
  profile: { lat: 28.6315, lng: 77.2167, address: 'Connaught Place, New Delhi' },
  verification_status: 'approved',
}
export const apiError = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail })
