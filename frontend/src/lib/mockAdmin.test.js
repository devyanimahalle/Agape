import { beforeEach, describe, expect, it, vi } from 'vitest'

// The demo store is module state, so every test starts from a freshly imported copy.
let store
beforeEach(async () => {
  vi.resetModules()
  store = await import('./mockAdmin')
})

const pending = () => store.mockPending()
const pendingIds = (type) => store.listMockRequests({ status: 'pending', type }).map((r) => r.id)

describe('demo overview: pending NGOs and pending donors', () => {
  it('starts with one of each, from the seeded open requests', () => {
    expect(pending()).toEqual({ ngos_pending: 1, providers_pending: 1 })
  })

  it('does not count approved or rejected accounts, or accounts that have not submitted anything', () => {
    const users = store.listMockUsers()
    expect(users.find((u) => u.name === 'Fresh Kitchen').profile.verification_status).toBe('approved')
    expect(users.find((u) => u.name === 'Meena').profile.verification_status).toBe('approved')
    expect(users.find((u) => u.name === 'Arjun').profile.status).toBe('rejected')
    const unsubmitted = users.find((u) => u.name === 'New NGO')
    expect(unsubmitted.profile.status).toBe('pending') // registered, but no request: nobody is waiting on it
    expect(store.listMockRequests().some((r) => r.user_id === unsubmitted.id)).toBe(false)
    expect(pending()).toEqual({ ngos_pending: 1, providers_pending: 1 })
  })

  it('approving the pending NGO and donor returns both counts to zero and verifies the accounts', () => {
    const [ngoReq] = pendingIds('ngo')
    const [donorReq] = pendingIds('provider')
    expect(store.decideMockRequest(ngoReq, 'approved').request.status).toBe('approved')
    expect(pending()).toEqual({ ngos_pending: 0, providers_pending: 1 })
    expect(store.decideMockRequest(donorReq, 'approved').request.status).toBe('approved')
    expect(pending()).toEqual({ ngos_pending: 0, providers_pending: 0 })

    const users = store.listMockUsers()
    expect(users.find((u) => u.name === 'Asha').profile.status).toBe('approved')
    expect(users.find((u) => u.name === 'Ravi').profile.verification_status).toBe('approved')
    expect(store.listMockRequests({ status: 'pending' })).toEqual([])
  })

  it('rejecting also clears the count and marks the account rejected', () => {
    store.decideMockRequest(pendingIds('ngo')[0], 'rejected', 'Unclear scan')
    store.decideMockRequest(pendingIds('provider')[0], 'rejected', 'PAN mismatch')
    expect(pending()).toEqual({ ngos_pending: 0, providers_pending: 0 })
    expect(store.listMockUsers().find((u) => u.name === 'Asha').profile.status).toBe('rejected')
  })

  it('a decision needs a reason to reject, and cannot be made twice', () => {
    const id = pendingIds('ngo')[0]
    expect(store.decideMockRequest(id, 'rejected').error.code).toBe('REASON_REQUIRED')
    expect(pending().ngos_pending).toBe(1)
    store.decideMockRequest(id, 'approved')
    expect(store.decideMockRequest(id, 'approved').error.code).toBe('ALREADY_DECIDED')
    expect(store.decideMockRequest(999, 'approved').error.code).toBe('NOT_FOUND')
  })

  it('a new submission raises the count by one and approving it lowers it again', () => {
    const { request } = store.submitMockRequest({ userId: 'mock-ngo', email: 'n@x.org', name: 'Demo NGO', type: 'ngo', org_name: 'Helpers', reg_number: 'R1' })
    expect(pending()).toEqual({ ngos_pending: 2, providers_pending: 1 })
    expect(store.listMockUsers().find((u) => u.id === 'mock-ngo').profile.status).toBe('pending')
    store.decideMockRequest(request.id, 'approved')
    expect(pending()).toEqual({ ngos_pending: 1, providers_pending: 1 })
  })

  it('refuses a second open request from the same account, so it counts once', () => {
    const first = { userId: 'mock-provider', email: 'd@x.org', name: 'Demo Donor', type: 'provider', org_name: 'Kitchen', fssai_number: '11112222333344' }
    store.submitMockRequest(first)
    expect(store.submitMockRequest(first).error.code).toBe('ALREADY_PENDING')
    expect(pending().providers_pending).toBe(2)
  })

  it('a resubmission after a rejection is pending again and returns to zero once approved', () => {
    const base = { userId: 'mock-ngo', email: 'n@x.org', name: 'Demo NGO', type: 'ngo', org_name: 'Helpers', reg_number: 'R1' }
    const first = store.submitMockRequest(base).request
    store.decideMockRequest(first.id, 'rejected', 'Blurry')
    store.decideMockRequest(pendingIds('ngo')[0], 'approved') // clear the seeded one
    expect(pending().ngos_pending).toBe(0)
    const again = store.submitMockRequest(base).request
    expect(pending().ngos_pending).toBe(1)
    expect(store.listMockUsers().find((u) => u.id === 'mock-ngo').profile.status).toBe('pending')
    store.decideMockRequest(again.id, 'approved')
    expect(pending().ngos_pending).toBe(0)
  })

  it('an already-approved account is never counted, even with an open request', () => {
    const { request } = store.submitMockRequest({ userId: 'mock-ngo', email: 'n@x.org', name: 'Demo NGO', type: 'ngo', org_name: 'Helpers', reg_number: 'R1' })
    expect(pending().ngos_pending).toBe(2)
    store.listMockUsers() // reads are copies...
    store.decideMockRequest(request.id, 'approved')
    store.submitMockRequest({ userId: 'mock-ngo', email: 'n@x.org', name: 'Demo NGO', type: 'ngo', org_name: 'Helpers', reg_number: 'R2' })
    expect(pending().ngos_pending).toBe(1) // the approved account's new request is not "pending"
  })
})

describe('demo accounts: deleting and resetting', () => {
  it('deleting a pending account removes its request and lowers the count and the user total', () => {
    const total = store.mockTotalUsers()
    store.deleteMockUser(202) // Asha, the pending NGO
    expect(pending()).toEqual({ ngos_pending: 0, providers_pending: 1 })
    expect(store.mockTotalUsers()).toBe(total - 1)
    expect(store.listMockRequests().some((r) => r.user_id === 202)).toBe(false)
  })

  it('reset removes every donor and NGO with their requests and keeps the admin', () => {
    expect(store.resetMockAccounts().deleted).toBe(7)
    expect(pending()).toEqual({ ngos_pending: 0, providers_pending: 0 })
    expect(store.listMockUsers().map((u) => u.role)).toEqual(['admin'])
    expect(store.listMockRequests()).toEqual([])
    expect(store.mockTotalUsers()).toBe(1)
  })

  it('deactivating an account changes nothing about the pending counts', () => {
    store.setMockUserActive(101, false)
    expect(pending()).toEqual({ ngos_pending: 1, providers_pending: 1 })
  })
})
