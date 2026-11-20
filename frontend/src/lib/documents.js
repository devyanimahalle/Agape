// Private documents (verification papers, proofs of donation) are only served to admins with a Bearer token, so they
// are fetched here and handed to the page as a temporary blob URL. The caller must URL.revokeObjectURL() it.
import { API_BASE, ApiError, USE_MOCKS, getToken } from './api'
import { getMockFile } from './mockProofs'

export async function fetchDocumentUrl(id) {
  if (USE_MOCKS) {
    const uploaded = getMockFile(id) // a proof of donation uploaded in this demo session
    if (uploaded) return URL.createObjectURL(uploaded)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f5f0e4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="#111111">Sample document ${id}</text></svg>`
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  }
  const token = getToken()
  let res
  try {
    res = await fetch(`${API_BASE}/admin/documents/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection.')
  }
  if (res.status === 404) throw new ApiError(404, 'NOT_FOUND', 'Document not found or already deleted.')
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.code ?? 'ERROR', typeof data?.detail === 'string' ? data.detail : 'Could not load document.')
  }
  return URL.createObjectURL(await res.blob())
}
