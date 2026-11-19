// API seam for the NGO board and reservations. When Role A's shared `api` client lands, replace
// `request` below with it; the exported function names are what this feature depends on.
// Set VITE_USE_MOCKS=true to develop without a backend (mock data has the exact contract shape).
import * as mock from './mockApi'

const BASE = import.meta.env?.VITE_API_BASE ?? '/api/v1'
const USE_MOCKS = import.meta.env?.VITE_USE_MOCKS === 'true'

export class ApiError extends Error {
  constructor(status, code, detail) {
    super(detail)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

function token() {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', params, json, form } = {}) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params ?? {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v))
  const headers = {}
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form // the browser sets the multipart boundary
  }
  let res
  try {
    res = await fetch(url, { method, headers, body })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Something went wrong'
    throw new ApiError(res.status, data?.code ?? 'ERROR', detail)
  }
  return data
}

export const getMe = () => (USE_MOCKS ? mock.getMe() : request('/auth/me'))
export const geocode = (q) => (USE_MOCKS ? mock.geocode(q) : request('/geocode', { params: { q } }))
export const getBoard = (lat, lng) =>
  USE_MOCKS ? mock.getBoard(lat, lng) : request('/board', { params: { lat, lng } })
export const reserve = (id) => (USE_MOCKS ? mock.reserve(id) : request(`/listings/${id}/reserve`, { method: 'POST' }))
export const cancelReservation = (id) =>
  USE_MOCKS ? mock.cancelReservation(id) : request(`/listings/${id}/cancel-reservation`, { method: 'POST' })
export const getReservations = (status) =>
  USE_MOCKS ? mock.getReservations(status) : request('/ngo/reservations', { params: { status } })
export const rateProvider = (id, { stars, comment }) =>
  USE_MOCKS
    ? mock.rateProvider(id, { stars, comment })
    : request(`/listings/${id}/rate-provider`, { method: 'POST', json: { stars, comment } })

/** Confirm the pickup in one step: no files. Proof of donation is uploaded afterwards (see submitProof). */
export const completePickup = (id) =>
  USE_MOCKS ? mock.completePickup(id) : request(`/listings/${id}/complete`, { method: 'POST' })

/** Proof of donation for a collected pickup: files (PDF, JPG or PNG up to 10 MB each) and an optional note. */
export function submitProof(id, files, note) {
  if (USE_MOCKS) return mock.submitProof(id, files, note)
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  if (note) form.append('note', note)
  return request(`/listings/${id}/proof`, { method: 'POST', form })
}
