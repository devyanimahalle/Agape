// Verification feature API. JSON/multipart → lib/api.js; blob fetch handled here.
// Set VITE_USE_MOCKS=true to run without a backend.
import { api, getToken, USE_MOCKS, ApiError } from '../../lib/api'
import * as mock from './mockApi'

export { USE_MOCKS, ApiError }

// ── Provider verification ────────────────────────────────────────────────────

export const getProviderVerification = () =>
  USE_MOCKS ? mock.getProviderVerification() : api('/provider/verification')

export const submitProviderStep1 = (fields) =>
  USE_MOCKS
    ? mock.submitProviderStep1(fields)
    : api('/provider/verification/step1', { method: 'POST', json: fields })

export const submitProviderStep2 = (fields) => {
  if (USE_MOCKS) return mock.submitProviderStep2(fields)
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => v != null && form.append(k, v))
  return api('/provider/verification/step2', { method: 'POST', form })
}

// ── NGO onboarding ────────────────────────────────────────────────────────────

export const getNgoVerification = () =>
  USE_MOCKS ? mock.getNgoVerification() : api('/ngo/verification')

export const submitNgoOnboarding = (fields) => {
  if (USE_MOCKS) return mock.submitNgoOnboarding(fields)
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => v != null && form.append(k, v))
  return api('/ngo/verification', { method: 'POST', form })
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const listVerifications = (params) =>
  USE_MOCKS ? mock.listVerifications(params) : api('/admin/verifications', { params })

export const decideVerification = (id, decision) =>
  USE_MOCKS
    ? mock.decideVerification(id, decision)
    : api(`/admin/verifications/${id}/decide`, { method: 'POST', json: decision })

/** Fetch a document as a blob using the Bearer token. Returns an object URL.
 *  Caller must call URL.revokeObjectURL(url) when done. */
export async function fetchDocumentUrl(id) {
  if (USE_MOCKS) return mock.fetchDocumentUrl(id)
  const token = getToken()
  let res
  try {
    res = await fetch(`/api/v1/admin/documents/${id}`, {
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
