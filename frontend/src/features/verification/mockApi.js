// In-memory mock for verification endpoints. Dev/demo use only.
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))
const err = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail })

// ── Provider state ────────────────────────────────────────────────────────────
let providerVerification = { status: 'not_submitted', rejection_reason: null }

export const getProviderVerification = () => wait(providerVerification)

export function submitProviderVerification({ entity_name, pan, aadhaar, fssai_number }) {
  if (!pan || !aadhaar || !fssai_number) return Promise.reject(err(422, 'VALIDATION_ERROR', 'PAN, Aadhaar and FSSAI number are required'))
  if (providerVerification.status === 'pending')
    return Promise.reject(err(409, 'ALREADY_PENDING', 'A verification request is already pending review'))
  providerVerification = {
    status: 'pending', rejection_reason: null, entity_name,
    masked_pan: 'XXXXX' + pan.slice(-5), masked_aadhaar: 'XXXX-XXXX-' + aadhaar.slice(-4), fssai_number,
  }
  return wait(providerVerification)
}

// ── NGO state ─────────────────────────────────────────────────────────────────
let ngoVerification = { status: 'not_submitted', rejection_reason: null, org_name: 'Your organisation', reg_number: null }

export const getNgoVerification = () => wait(ngoVerification)

export function submitNgoOnboarding({ reg_number }) {
  if (!reg_number) return Promise.reject(err(422, 'VALIDATION_ERROR', 'Registration number is required'))
  if (ngoVerification.status === 'pending')
    return Promise.reject(err(409, 'DUPLICATE_PENDING', 'A pending submission already exists'))
  ngoVerification = { ...ngoVerification, status: 'pending', rejection_reason: null, reg_number }
  return wait(ngoVerification)
}

// ── Admin state ───────────────────────────────────────────────────────────────
let verifications = [
  { id: 1, type: 'provider', status: 'pending', user_id: 101, user_email: 'ravi@demo.com', org_name: 'Ravi Kitchen', entity_name: "Ravi's Kitchen", submitted_at: new Date().toISOString(), masked_pan: 'XXXXX1234F', masked_aadhaar: 'XXXX-XXXX-5678', fssai_number: '12345678901234', documents: [{ id: 'doc-1', kind: 'business_proof', label: 'Business registration' }, { id: 'doc-5', kind: 'fssai_cert', label: 'FSSAI certificate' }] },
  { id: 2, type: 'ngo', status: 'pending', user_id: 202, user_email: 'asha@ngo.demo', submitted_at: new Date().toISOString(), documents: [{ id: 'doc-2', kind: 'ngo_reg', label: 'NGO registration' }], org_name: 'Asha Foundation', reg_number: 'REG/2023/001' },
  { id: 3, type: 'provider', status: 'approved', user_id: 103, user_email: 'meena@demo.com', org_name: 'Meena Caterers', entity_name: 'Meena Caterers', submitted_at: new Date().toISOString(), masked_pan: 'XXXXX9876K', masked_aadhaar: 'XXXX-XXXX-4321', fssai_number: '98765432109876', documents: [{ id: 'doc-3', kind: 'business_proof', label: 'Business registration' }, { id: 'doc-6', kind: 'fssai_cert', label: 'FSSAI certificate' }] },
  { id: 4, type: 'ngo', status: 'rejected', rejection_reason: 'Registration number does not match records', user_id: 104, user_email: 'arjun@ngo.demo', submitted_at: new Date().toISOString(), documents: [{ id: 'doc-4', kind: 'ngo_reg', label: 'NGO registration' }], org_name: 'Arjun Trust', reg_number: 'REG/2020/777' },
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
