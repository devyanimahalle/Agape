// Shared fetch wrapper. Base URL from VITE_API_BASE; Bearer token from localStorage['access_token'].
export const API_BASE = import.meta.env?.VITE_API_BASE ?? '/api/v1'
export const USE_MOCKS = import.meta.env?.VITE_USE_MOCKS === 'true'
export const TOKEN_KEY = 'access_token'

export class ApiError extends Error {
  constructor(status, code, detail) {
    super(detail)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
}

export async function api(path, { method = 'GET', params, json, form } = {}) {
  const url = new URL(API_BASE + path, window.location.origin)
  Object.entries(params ?? {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v))
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  let res
  try {
    res = await fetch(url, { method, headers, body })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? 'ERROR', typeof data?.detail === 'string' ? data.detail : 'Something went wrong')
  }
  return data
}
