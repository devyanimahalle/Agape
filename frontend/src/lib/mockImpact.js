// Demo-mode Impact figures, computed from the shared demo stores exactly the way the backend computes them from its
// tables (listings, proofs, accounts). Nothing here is stored: every call re-reads the stores, so a pickup confirmed,
// a proof approved, an account deleted or a reset shows up on the next read. Dev/demo use only.
import { DEMO, NGO_NAMES, listings } from './mockListings'
import { listMockUsers, mockPending, mockTotalUsers } from './mockAdmin'
import { listMockProofs, mockProofSummary } from './mockProofs'

const STATUSES = ['listed', 'reserved', 'completed', 'cancelled', 'expired']
const RECENT_LIMIT = 8
const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0)

const collected = () => listings.filter((l) => l.status === 'completed')

const recentItem = (l, names) => ({
  id: l.id, title: l.title, food_type: l.food_type, quantity: l.quantity, unit: l.unit, est_meals: l.est_meals, est_kg: l.est_kg,
  completed_at: l.completed_at, donor_category: l.category, proof_status: mockProofSummary(l.id).status,
  donor: names ? l.org : null, ngo: names ? NGO_NAMES[l.reserved_by_ngo_id] ?? null : null,
})

const latest = (rows, names) => [...rows].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, RECENT_LIMIT).map((l) => recentItem(l, names))

const verified = (role) => listMockUsers().filter((u) => u.role === role && u.profile && (u.profile.verification_status ?? u.profile.status) === 'approved').length

export function mockImpact() {
  const done = collected()
  const confirmed = done.filter((l) => mockProofSummary(l.id).status === 'approved')

  const months = {}
  for (const l of done) {
    const key = new Date(l.completed_at).toISOString().slice(0, 7)
    months[key] ??= { month: key, meals: 0, kg: 0 }
    months[key].meals += l.est_meals
    months[key].kg += l.est_kg
  }

  const cats = {}
  for (const l of done) {
    cats[l.category] ??= { category: l.category, listings: 0, meals: 0, kg: 0 }
    cats[l.category].listings += 1
    cats[l.category].meals += l.est_meals
    cats[l.category].kg += l.est_kg
  }

  const by_status = Object.fromEntries(STATUSES.map((s) => [s, listings.filter((l) => l.status === s).length]))

  return {
    meals_redistributed: sum(done, 'est_meals'),
    kg_saved: sum(done, 'est_kg'),
    listings_completed: done.length,
    active_ngos: new Set(done.map((l) => l.reserved_by_ngo_id)).size,
    active_providers: new Set(done.map((l) => l.provider_id)).size,
    by_month: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
    listings_confirmed: confirmed.length,
    meals_confirmed: sum(confirmed, 'est_meals'),
    verified_donors: verified('provider'),
    verified_ngos: verified('ngo'),
    by_status,
    by_category: Object.values(cats).sort((a, b) => b.meals - a.meals || a.category.localeCompare(b.category)),
    recent: latest(done, false), // public: no organisation names
  }
}

const proofStates = (rows) => rows.map((l) => mockProofSummary(l.id).status)

export function mockMyImpact(role) {
  if (role === 'provider') {
    const mine = listings.filter((l) => l.provider_id === DEMO.donorId)
    const done = mine.filter((l) => l.status === 'completed')
    const states = proofStates(done)
    return {
      role,
      summary: {
        listings_total: mine.length,
        listings_open: mine.filter((l) => l.status === 'listed').length,
        listings_reserved: mine.filter((l) => l.status === 'reserved').length,
        pickups_completed: done.length,
        meals_donated: sum(done, 'est_meals'),
        kg_donated: sum(done, 'est_kg'),
        proofs_approved: states.filter((s) => s === 'approved').length,
        proofs_awaiting: states.filter((s) => s === 'pending').length,
      },
      recent: latest(done, true),
    }
  }
  if (role === 'ngo') {
    const mine = listings.filter((l) => l.reserved_by_ngo_id === DEMO.ngoId)
    const done = mine.filter((l) => l.status === 'completed')
    const states = proofStates(done)
    return {
      role,
      summary: {
        reservations_open: mine.filter((l) => l.status === 'reserved').length,
        pickups_completed: done.length,
        meals_collected: sum(done, 'est_meals'),
        kg_collected: sum(done, 'est_kg'),
        proofs_needed: done.length - states.filter((s) => s === 'pending' || s === 'approved').length,
        proofs_awaiting: states.filter((s) => s === 'pending').length,
        proofs_approved: states.filter((s) => s === 'approved').length,
      },
      recent: latest(done, true),
    }
  }
  const pending = mockPending()
  return {
    role: 'admin',
    summary: {
      users_total: mockTotalUsers(),
      verified_donors: verified('provider'),
      verified_ngos: verified('ngo'),
      verifications_open: pending.ngos_pending + pending.providers_pending,
      proofs_awaiting_review: new Set(listMockProofs('pending').map((p) => p.listing_id)).size,
      pickups_completed: collected().length,
    },
    recent: latest(collected(), true),
  }
}
