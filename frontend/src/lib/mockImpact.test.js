import { beforeEach, describe, expect, it, vi } from 'vitest'

// Everything lives in module state, so each test gets freshly imported stores.
let ngo
let admin
let donor
let impact
let listingsStore
let adminApi

beforeEach(async () => {
  vi.resetModules()
  vi.doMock('./api', async (orig) => ({ ...(await orig()), USE_MOCKS: true }))
  ngo = await import('../features/ngo-reservations/mockApi')
  admin = await import('./mockAdmin')
  donor = await import('../features/provider-listings/api')
  impact = await import('./mockImpact')
  listingsStore = await import('./mockListings')
  adminApi = await import('../features/admin-impact/api')
})

const file = () => new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' })

describe('demo Impact is computed from the stores', () => {
  it('starts from the seeded history, with every figure derivable from the listings', () => {
    const data = impact.mockImpact()
    const done = listingsStore.listings.filter((l) => l.status === 'completed')
    expect(data.listings_completed).toBe(done.length)
    expect(data.meals_redistributed).toBe(done.reduce((n, l) => n + l.est_meals, 0))
    expect(data.kg_saved).toBeCloseTo(done.reduce((n, l) => n + l.est_kg, 0))
    expect(data.by_status).toEqual({ listed: 5, reserved: 0, completed: 5, cancelled: 1, expired: 1 })
    expect(data.by_month.reduce((n, m) => n + m.meals, 0)).toBe(data.meals_redistributed)
    expect(data.by_category.reduce((n, c) => n + c.meals, 0)).toBe(data.meals_redistributed)
    expect(data.by_category.map((c) => c.category).sort()).toEqual(['caterer', 'general', 'restaurant'])
    expect(data.recent.length).toBe(5)
    expect(data.recent.every((r) => r.donor === null && r.ngo === null)).toBe(true) // public: no names
  })

  it('verified donors and NGOs come from the approved accounts', () => {
    const data = impact.mockImpact()
    const users = admin.listMockUsers()
    const approved = (role) => users.filter((u) => u.role === role && (u.profile.verification_status ?? u.profile.status) === 'approved').length
    expect([data.verified_donors, data.verified_ngos]).toEqual([approved('provider'), approved('ngo')])
    expect(data.verified_donors).toBe(2)
  })

  it('only an approved proof of donation counts as confirmed', () => {
    const before = impact.mockImpact()
    expect([before.listings_confirmed, before.meals_confirmed]).toEqual([1, 25]) // the seeded approved proof
  })

  it('collecting a pickup raises the totals, the breakdowns and the recent list at once', async () => {
    const before = impact.mockImpact()
    await ngo.reserve(1)
    expect(impact.mockImpact().by_status).toMatchObject({ listed: 4, reserved: 1 })
    expect(impact.mockImpact().meals_redistributed).toBe(before.meals_redistributed) // reserved is not collected
    await ngo.completePickup(1)
    const after = impact.mockImpact()
    expect(after.listings_completed).toBe(before.listings_completed + 1)
    expect(after.meals_redistributed).toBe(before.meals_redistributed + 50) // Veg biryani, estimated 50 meals
    expect(after.by_status).toMatchObject({ reserved: 0, completed: 6 })
    expect(after.recent[0]).toMatchObject({ id: 1, title: 'Veg biryani', est_meals: 50, proof_status: 'none' })
    expect(after.by_category.find((c) => c.category === 'restaurant').listings).toBe(4)
  })

  it('proof of donation and its approval move the confirmed figures', async () => {
    await ngo.reserve(3)
    await ngo.completePickup(3)
    await ngo.submitProof(3, [file()], 'fed 20 people')
    expect(impact.mockImpact().recent[0].proof_status).toBe('pending')
    expect(impact.mockImpact().meals_confirmed).toBe(25)
    const proof = (await adminApi.fetchProofs('pending')).find((p) => p.listing_id === 3)
    await adminApi.reviewProof(proof.id, { decision: 'approved', stars: 5 })
    const after = impact.mockImpact()
    expect([after.listings_confirmed, after.meals_confirmed]).toEqual([2, 45]) // 25 + the bread's 20
    expect(after.recent[0].proof_status).toBe('approved')
  })

  it('a listing the demo donor creates is on the NGO board, and collecting it counts for the donor and for Impact', async () => {
    const created = await donor.createListing({ title: 'Demo soup', food_type: 'cooked meal', quantity: 20, unit: 'portions', window_start: new Date().toISOString(), window_end: new Date(Date.now() + 3 * 3600e3).toISOString(), address: 'Delhi', lat: 28.6, lng: 77.2, notes: null })
    expect(created).toMatchObject({ status: 'listed', est_meals: 20 })
    expect((await ngo.getBoard(28.6, 77.2)).map((r) => r.id)).toContain(created.id)
    expect((await donor.fetchMyListings()).map((r) => r.id)).toContain(created.id)

    await ngo.reserve(created.id)
    await ngo.completePickup(created.id)
    expect(impact.mockImpact().recent[0]).toMatchObject({ id: created.id, title: 'Demo soup', est_meals: 20 })
    const mine = impact.mockMyImpact('provider')
    expect(mine.summary.pickups_completed).toBe(2) // the seeded Poha pickup plus this one
    expect((await donor.fetchMyListings()).find((r) => r.id === created.id).status).toBe('completed')
  })

  it('cancelling a reservation puts the food back and changes no impact', async () => {
    const before = impact.mockImpact()
    await ngo.reserve(4)
    await ngo.cancelReservation(4)
    const after = impact.mockImpact()
    expect(after.by_status).toEqual(before.by_status)
    expect(after.meals_redistributed).toBe(before.meals_redistributed)
  })
})

describe('demo accounts and reset', () => {
  it('deleting a donor removes its collected pickups from the totals', () => {
    const before = impact.mockImpact()
    admin.deleteMockUser(2) // Fresh Kitchen, donor of two collected pickups (100 estimated meals)
    const after = impact.mockImpact()
    expect(after.listings_completed).toBe(before.listings_completed - 2)
    expect(after.meals_redistributed).toBe(before.meals_redistributed - 100)
    expect(after.verified_donors).toBe(before.verified_donors - 1)
    expect(after.by_status.completed).toBe(before.by_status.completed - 2)
  })

  it('deleting an NGO releases what it had reserved, so its collected pickups leave the totals (like the backend)', () => {
    const before = impact.mockImpact()
    admin.deleteMockUser(3) // Feed the Hungry collected three of the seeded pickups
    const after = impact.mockImpact()
    expect(after.verified_ngos).toBe(before.verified_ngos - 1)
    expect(after.listings_completed).toBe(before.listings_completed - 3)
    expect(after.by_status).toMatchObject({ completed: before.by_status.completed - 3, cancelled: before.by_status.cancelled + 3 })
  })

  it('Reset demo accounts takes every Impact figure to zero', () => {
    admin.resetMockAccounts()
    const data = impact.mockImpact()
    expect([data.meals_redistributed, data.kg_saved, data.listings_completed, data.verified_donors, data.verified_ngos, data.meals_confirmed]).toEqual([0, 0, 0, 0, 0, 0])
    expect(data.recent).toEqual([])
    expect(data.by_month).toEqual([])
    expect(Object.values(data.by_status).every((v) => v === 0)).toBe(true)
    expect(data.by_category).toEqual([])
    for (const role of ['provider', 'ngo']) {
      expect(impact.mockMyImpact(role).recent).toEqual([])
      expect(impact.mockMyImpact(role).summary.pickups_completed).toBe(0)
    }
    expect(impact.mockMyImpact('admin').summary).toMatchObject({ users_total: 1, pickups_completed: 0, verified_donors: 0 })
  })
})

describe('the signed-in history matches the records', () => {
  it('the demo NGO sees its own reservations and proof state', async () => {
    const reservations = await ngo.getReservations()
    const mine = impact.mockMyImpact('ngo')
    expect(mine.summary.pickups_completed).toBe(reservations.filter((r) => r.status === 'completed').length)
    expect(mine.summary.reservations_open).toBe(reservations.filter((r) => r.status === 'reserved').length)
    expect(mine.summary.proofs_needed).toBe(1) // the seeded roti and sabzi pickup has no proof yet
    expect(mine.recent[0]).toMatchObject({ title: 'Roti and sabzi', ngo: 'Asha Foundation', donor: 'Neighbour Home Kitchen', proof_status: 'none' })
  })

  it('collecting and proving a pickup updates the NGO summary', async () => {
    await ngo.reserve(1)
    expect(impact.mockMyImpact('ngo').summary.reservations_open).toBe(1)
    await ngo.completePickup(1)
    expect(impact.mockMyImpact('ngo').summary).toMatchObject({ reservations_open: 0, pickups_completed: 2, proofs_needed: 2 })
    await ngo.submitProof(1, [file()], '')
    expect(impact.mockMyImpact('ngo').summary).toMatchObject({ proofs_needed: 1, proofs_awaiting: 1 })
  })

  it('the demo donor sees its own listings and collected pickups, not other donors\'', async () => {
    const own = await donor.fetchMyListings()
    const mine = impact.mockMyImpact('provider')
    expect(mine.summary.listings_total).toBe(own.length)
    expect(mine.summary.listings_open).toBe(own.filter((l) => l.status === 'listed').length)
    expect(mine.summary.pickups_completed).toBe(own.filter((l) => l.status === 'completed').length)
    expect(mine.summary.meals_donated).toBe(30) // Poha, 30 portions
    expect(mine.recent.map((r) => r.title)).toEqual(['Poha, 30 portions'])
    expect(mine.recent[0]).toMatchObject({ donor: 'Demo Kitchen', ngo: 'Feed the Hungry' })
  })

  it('the admin summary matches the platform records', async () => {
    const stats = await adminApi.fetchStats()
    const me = impact.mockMyImpact('admin')
    expect(me.summary.users_total).toBe(stats.total_users)
    expect(me.summary.verifications_open).toBe(stats.ngos_pending + stats.providers_pending)
    expect(me.summary.pickups_completed).toBe(stats.listings_by_status.completed)
    expect(me.summary.proofs_awaiting_review).toBe(2) // the two seeded pending proofs
  })

  it('the admin overview\'s listing counts are the same records Impact uses', async () => {
    const stats = await adminApi.fetchStats()
    expect(stats.listings_by_status).toEqual(impact.mockImpact().by_status)
  })
})
