// Verification feature API (Role C). The page-facing shapes below are adapted from the backend's:
//   provider  GET  /verification/provider/status      POST /verification/provider (multipart, ONE combined request:
//             identity and business details + documents together with the FSSAI number and certificate)
//   ngo       GET  /verification/ngo/status           POST /verification/ngo (multipart)
//   admin     GET  /admin/verifications               POST /admin/verifications/{id}/decision (form)
//             GET  /admin/documents/{id}   (file; fetched with the Bearer token, so it is turned into a blob URL)
// Set VITE_USE_MOCKS=true to run without a backend.
import { api, API_BASE, getToken, USE_MOCKS, ApiError } from '../../lib/api'
import * as mock from './mockApi'

export { USE_MOCKS, ApiError }

const toForm = (fields) => {
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => v != null && v !== '' && form.append(k, v))
  return form
}

// ── Provider verification ────────────────────────────────────────────────────

const shapeProvider = (d) => ({
  status: d.status,
  rejection_reason: d.reason ?? null,
  entity_name: d.entity_name,
  masked_pan: d.masked_pan,
  masked_aadhaar: d.masked_aadhaar,
  fssai_number: d.fssai_number,
})

export const getProviderVerification = () =>
  USE_MOCKS ? mock.getProviderVerification() : api('/verification/provider/status').then(shapeProvider)

export async function submitProviderVerification({ entity_name, business_proof, pan, aadhaar, fssai_number, fssai_cert }) {
  if (USE_MOCKS) return mock.submitProviderVerification({ entity_name, pan, aadhaar, fssai_number })
  await api('/verification/provider', {
    method: 'POST',
    form: toForm({ entity_name, business_proof, pan_number: pan, aadhaar_number: aadhaar, fssai_number, fssai_cert }),
  })
  return getProviderVerification()
}

// ── NGO onboarding ────────────────────────────────────────────────────────────

export const getNgoVerification = () =>
  USE_MOCKS
    ? mock.getNgoVerification()
    : api('/verification/ngo/status').then((d) => ({
        status: d.status,
        rejection_reason: d.reason ?? null,
        org_name: d.org_name,
        reg_number: d.reg_number,
      }))

export async function submitNgoOnboarding({ reg_number, document }) {
  if (USE_MOCKS) return mock.submitNgoOnboarding({ reg_number })
  await api('/verification/ngo', { method: 'POST', form: toForm({ reg_number, ngo_reg: document }) })
  return getNgoVerification()
}

// ── Admin ─────────────────────────────────────────────────────────────────────

const shapeVerification = (row) => ({
  id: row.id,
  type: row.subject_type, // 'provider' | 'ngo'
  status: row.status,
  user_id: row.subject_user_id,
  user_email: row.user_email,
  org_name: row.org_name,
  entity_name: row.entity_name,
  reg_number: row.subject_type === 'ngo' ? row.entity_name : undefined,
  pan_masked: row.masked_pan,
  aadhaar_masked: row.masked_aadhaar,
  fssai_number: row.fssai_number,
  rejection_reason: row.reason,
  submitted_at: row.created_at,
  documents: row.documents ?? [],
})

export async function listVerifications({ status, type } = {}) {
  if (USE_MOCKS) return mock.listVerifications({ status, type })
  const rows = await api('/admin/verifications', { params: { status, type } })
  return rows.map(shapeVerification)
}

export function decideVerification(id, { decision, rejection_reason }) {
  if (USE_MOCKS) return mock.decideVerification(id, { decision, rejection_reason })
  return api(`/admin/verifications/${id}/decision`, {
    method: 'POST',
    form: toForm({ decision: decision === 'approve' ? 'approved' : 'rejected', reason: rejection_reason }),
  })
}

/** Fetch a document as a blob using the Bearer token. Returns an object URL.
 *  Caller must call URL.revokeObjectURL(url) when done. */
export async function fetchDocumentUrl(id) {
  if (USE_MOCKS) return mock.fetchDocumentUrl(id)
  const token = getToken()
  let res
  try {
    res = await fetch(`${API_BASE}/admin/documents/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection.')
  }
  if (res.status === 404) throw new ApiError(404, 'NOT_FOUND', 'Document not found or already deleted.')
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.code ?? 'ERROR', typeof data?.detail === 'string' ? data.detail : 'Could not load document.')
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
