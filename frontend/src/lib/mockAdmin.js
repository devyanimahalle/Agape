// Demo-mode store for accounts and verification requests, shared by everything that shows them: the admin overview
// (PENDING NGOS and PENDING DONORS), the users list, the verification queue and the NGO and donor verification pages.
// Counts are computed from this one store, never kept as a separate number, so they cannot go stale: approving or
// rejecting a request, deleting an account or resetting changes what every screen reads next. Dev/demo use only.
import { clearMockListings, listings, removeListingsFor } from './mockListings'
import { clearMockProofs, removeMockProofsFor } from './mockProofs'

const now = () => new Date().toISOString()

const profile = (o) => ({ rating_avg: null, rating_count: 0, ...o })

let users = [
  { id: 1, email: 'admin@agape.demo', role: 'admin', name: 'Demo Admin', phone: '9999999999', is_active: true, created_at: '2026-01-01T00:00:00Z', profile: null },
  { id: 2, email: 'restaurant@agape.demo', role: 'provider', name: 'Fresh Kitchen', phone: '9999999998', is_active: true, created_at: '2026-01-02T00:00:00Z', profile: profile({ org_name: 'Fresh Kitchen', category: 'restaurant', verification_status: 'approved', rating_avg: 4.5, rating_count: 2 }) },
  { id: 3, email: 'ngo1@agape.demo', role: 'ngo', name: 'Feed the Hungry', phone: '9999999997', is_active: true, created_at: '2026-01-03T00:00:00Z', profile: profile({ org_name: 'Feed the Hungry', status: 'approved', rating_avg: 4, rating_count: 1 }) },
  // registered but has not submitted anything yet: not waiting for an admin, so not counted as pending
  { id: 4, email: 'ngo3@agape.demo', role: 'ngo', name: 'New NGO', phone: '9999999996', is_active: true, created_at: '2026-02-01T00:00:00Z', profile: profile({ org_name: 'New NGO', status: 'pending' }) },
  { id: 101, email: 'ravi@demo.com', role: 'provider', name: 'Ravi', phone: '9999999995', is_active: true, created_at: '2026-02-02T00:00:00Z', profile: profile({ org_name: 'Ravi Kitchen', category: 'restaurant', verification_status: 'pending' }) },
  { id: 202, email: 'asha@ngo.demo', role: 'ngo', name: 'Asha', phone: '9999999994', is_active: true, created_at: '2026-02-03T00:00:00Z', profile: profile({ org_name: 'Asha Foundation', status: 'pending' }) },
  { id: 103, email: 'meena@demo.com', role: 'provider', name: 'Meena', phone: '9999999993', is_active: true, created_at: '2026-02-04T00:00:00Z', profile: profile({ org_name: 'Meena Caterers', category: 'caterer', verification_status: 'approved' }) },
  { id: 104, email: 'arjun@ngo.demo', role: 'ngo', name: 'Arjun', phone: '9999999992', is_active: true, created_at: '2026-02-05T00:00:00Z', profile: profile({ org_name: 'Arjun Trust', status: 'rejected' }) },
]

const docs = (type, base) => (type === 'ngo'
  ? [{ id: `doc-${base}`, kind: 'ngo_reg', label: 'NGO registration' }]
  : [{ id: `doc-${base}`, kind: 'business_proof', label: 'Business registration' }, { id: `doc-${base + 100}`, kind: 'fssai_cert', label: 'FSSAI certificate' }])

let requests = [
  { id: 1, type: 'provider', status: 'pending', user_id: 101, user_email: 'ravi@demo.com', org_name: 'Ravi Kitchen', entity_name: "Ravi's Kitchen", submitted_at: now(), pan_masked: 'XXXXX1234F', aadhaar_masked: 'XXXX-XXXX-5678', fssai_number: '12345678901234', documents: docs('provider', 1), rejection_reason: null },
  { id: 2, type: 'ngo', status: 'pending', user_id: 202, user_email: 'asha@ngo.demo', org_name: 'Asha Foundation', reg_number: 'REG/2023/001', submitted_at: now(), documents: docs('ngo', 2), rejection_reason: null },
  { id: 3, type: 'provider', status: 'approved', user_id: 103, user_email: 'meena@demo.com', org_name: 'Meena Caterers', entity_name: 'Meena Caterers', submitted_at: now(), pan_masked: 'XXXXX9876K', aadhaar_masked: 'XXXX-XXXX-4321', fssai_number: '98765432109876', documents: docs('provider', 3), rejection_reason: null },
  { id: 4, type: 'ngo', status: 'rejected', user_id: 104, user_email: 'arjun@ngo.demo', org_name: 'Arjun Trust', reg_number: 'REG/2020/777', submitted_at: now(), documents: docs('ngo', 4), rejection_reason: 'Registration number does not match records' },
]
let nextRequest = 100

const clone = (v) => structuredClone(v)
const statusKey = (u) => (u.role === 'provider' ? 'verification_status' : 'status')

// ── accounts ──────────────────────────────────────────────────────────────────
export const listMockUsers = () => clone(users)

export function setMockUserActive(id, isActive) {
  const user = users.find((u) => u.id === id)
  if (!user) return null
  user.is_active = isActive
  return clone(user)
}

// Deleting an account removes its requests too, like the backend.
export function deleteMockUser(id) {
  const owned = listings.filter((l) => l.provider_id === id).map((l) => l.id)
  removeMockProofsFor(id, owned)
  removeListingsFor(id)
  users = users.filter((u) => u.id !== id)
  requests = requests.filter((r) => r.user_id !== id)
  return { deleted: 1 }
}

export function resetMockAccounts() {
  const gone = users.filter((u) => u.role !== 'admin').map((u) => u.id)
  users = users.filter((u) => u.role === 'admin')
  requests = requests.filter((r) => !gone.includes(r.user_id))
  clearMockListings() // every donor and NGO is gone, and so is what they listed, collected and uploaded
  clearMockProofs()
  return { deleted: gone.length }
}

// ── verification requests ─────────────────────────────────────────────────────
export function listMockRequests({ status, type } = {}) {
  return clone(requests.filter((r) => (!status || r.status === status) && (!type || r.type === type)))
}

export const latestMockRequest = (userId, type) => {
  const mine = requests.filter((r) => r.user_id === userId && r.type === type)
  return mine.length ? clone(mine[mine.length - 1]) : null
}

// Applies an admin decision to the request AND the account it belongs to. Returns { error } or { request }.
export function decideMockRequest(id, decision, reason) {
  const req = requests.find((r) => r.id === id)
  if (!req) return { error: { status: 404, code: 'NOT_FOUND', detail: 'Verification not found' } }
  if (req.status !== 'pending') return { error: { status: 409, code: 'ALREADY_DECIDED', detail: 'Already decided' } }
  if (decision === 'rejected' && !reason) return { error: { status: 422, code: 'REASON_REQUIRED', detail: 'Rejection reason is required' } }
  req.status = decision
  req.rejection_reason = decision === 'rejected' ? reason : null
  const user = users.find((u) => u.id === req.user_id)
  if (user?.profile) user.profile[statusKey(user)] = decision
  return { request: clone(req) }
}

// A donor or NGO submits its verification: the account is created if the demo session has none yet, a pending
// request joins the queue and the account reads as pending until an admin decides.
export function submitMockRequest({ userId, email, name, type, org_name, ...fields }) {
  const latest = latestMockRequest(userId, type)
  if (latest?.status === 'pending') return { error: { status: 409, code: 'ALREADY_PENDING', detail: 'A verification request is already pending review' } }
  let user = users.find((u) => u.id === userId)
  if (!user) {
    user = {
      id: userId, email, role: type === 'ngo' ? 'ngo' : 'provider', name, phone: '9999999990', is_active: true, created_at: now(),
      profile: profile(type === 'ngo' ? { org_name, status: 'pending' } : { org_name, category: 'restaurant', verification_status: 'pending' }),
    }
    users = [...users, user]
  } else if (user.profile && user.profile[statusKey(user)] !== 'approved') {
    user.profile[statusKey(user)] = 'pending'
  }
  const id = nextRequest++
  requests = [...requests, { id, type, status: 'pending', user_id: userId, user_email: email, org_name, submitted_at: now(), documents: docs(type, id), rejection_reason: null, ...fields }]
  return { request: clone(requests[requests.length - 1]) }
}

// ── overview ──────────────────────────────────────────────────────────────────
// "Pending" = an open request from an account that is not already approved, one per account. Same rule as the backend.
export function mockPending() {
  const open = (type) => new Set(
    requests
      .filter((r) => r.type === type && r.status === 'pending')
      .filter((r) => {
        const user = users.find((u) => u.id === r.user_id)
        return user && user.profile?.[statusKey(user)] !== 'approved'
      })
      .map((r) => r.user_id),
  ).size
  return { ngos_pending: open('ngo'), providers_pending: open('provider') }
}

export const mockTotalUsers = () => users.length
