// In-memory mock for verification endpoints. Dev/demo use only.
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))
const err = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail })

// ── Provider state ────────────────────────────────────────────────────────────
let providerVerification = {
  step1: { status: 'not_submitted', rejection_reason: null },
  step2: { status: 'not_submitted', rejection_reason: null },
  overall: 'not_submitted',
}

export const getProviderVerification = () => wait(providerVerification)

export function submitProviderStep1({ pan, aadhaar, fssai }) {
  if (!pan || !aadhaar) return Promise.reject(err(422, 'VALIDATION_ERROR', 'PAN and Aadhaar are required'))
  if (providerVerification.step1.status === 'pending')
    return Promise.reject(err(409, 'DUPLICATE_PENDING', 'A pending submission already exists'))
  providerVerification.step1 = { status: 'pending', rejection_reason: null, pan_masked: pan.slice(0, 2) + '***' + pan.slice(-2), aadhaar_masked: '****' + aadhaar.slice(-4), fssai: fssai ?? null }
  providerVerification.overall = 'pending'
  return wait(providerVerification)
}

export function submitProviderStep2(fields) {
  if (providerVerification.step1.status !== 'approved')
    return Promise.reject(err(403, 'STEP_GATING', 'Complete step 1 first'))
  if (providerVerification.step2.status === 'pending')
    return Promise.reject(err(409, 'DUPLICATE_PENDING', 'A pending submission already exists'))
  providerVerification.step2 = { status: 'pending', rejection_reason: null }
  providerVerification.overall = 'pending'
  return wait(providerVerification)
}

// ── NGO state ─────────────────────────────────────────────────────────────────
let ngoVerification = { status: 'not_submitted', rejection_reason: null, org_name: null, reg_number: null }

export const getNgoVerification = () => wait(ngoVerification)

export function submitNgoOnboarding({ org_name, reg_number, document }) {
  if (!org_name || !reg_number) return Promise.reject(err(422, 'VALIDATION_ERROR', 'Org name and registration number are required'))
  if (ngoVerification.status === 'pending')
    return Promise.reject(err(409, 'DUPLICATE_PENDING', 'A pending submission already exists'))
  ngoVerification = { status: 'pending', rejection_reason: null, org_name, reg_number }
  return wait(ngoVerification)
}

// ── Admin state ───────────────────────────────────────────────────────────────
let verifications = [
  { id: 1, type: 'provider_step1', status: 'pending', user_id: 101, user_email: 'ravi@demo.com', submitted_at: new Date().toISOString(), document_id: 'doc-1', pan_masked: 'AB***Z', aadhaar_masked: '****5678' },
  { id: 2, type: 'ngo', status: 'pending', user_id: 202, user_email: 'asha@ngo.demo', submitted_at: new Date().toISOString(), document_id: 'doc-2', org_name: 'Asha Foundation', reg_number: 'REG/2023/001' },
  { id: 3, type: 'provider_step2', status: 'approved', user_id: 103, user_email: 'meena@demo.com', submitted_at: new Date().toISOString(), document_id: 'doc-3' },
  { id: 4, type: 'provider_step1', status: 'rejected', rejection_reason: 'PAN does not match records', user_id: 104, user_email: 'arjun@demo.com', submitted_at: new Date().toISOString(), document_id: 'doc-4' },
]

export function listVerifications({ status, type } = {}) {
  let rows = verifications
  if (status) rows = rows.filter((v) => v.status === status)
  if (type) rows = rows.filter((v) => v.type === type)
  return wait(rows)
}

export function decideVerification(id, { decision, rejection_reason }) {
  const v = verifications.find((x) => x.id === id)
  if (!v) return Promise.reject(err(404, 'NOT_FOUND', 'Verification not found'))
  if (v.status !== 'pending') return Promise.reject(err(409, 'ALREADY_DECIDED', 'Already decided'))
  if (decision === 'reject' && !rejection_reason) return Promise.reject(err(422, 'REASON_REQUIRED', 'Rejection reason is required'))
  v.status = decision === 'approve' ? 'approved' : 'rejected'
  v.rejection_reason = rejection_reason ?? null
  return wait(v)
}

export function fetchDocumentUrl(id) {
  // Return a data URL placeholder in mock mode
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="#6b7280">Mock document ${id}</text></svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return Promise.resolve(URL.createObjectURL(blob))
}
