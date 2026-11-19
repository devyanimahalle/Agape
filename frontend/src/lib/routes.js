// Where each role lands after sign-in. `donor` is accepted as an alias of the backend's `provider`.
export function homeForRole(role) {
  if (role === 'ngo') return '/ngo'
  if (role === 'provider' || role === 'donor') return '/provider'
  if (role === 'admin') return '/admin'
  return '/'
}

// Accept only same-site relative paths from ?next= (blocks open redirects such as //evil.com or /\evil.com).
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return null
  const second = next.charAt(1)
  if (second === '/' || second === '\\') return null
  if (next.startsWith('/login')) return null
  return next
}

// Sign-in entry. `/select-role` is the gateway; `/login?role=ngo|provider|admin` is the portal for one role.
export const PORTAL_ROLES = ['ngo', 'provider', 'admin']
export const isPortalRole = (r) => PORTAL_ROLES.includes(r)

const withNext = (path, role, next) => {
  const q = new URLSearchParams()
  if (role) q.set('role', role)
  const safe = safeNext(next)
  if (safe) q.set('next', safe)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

export const selectRolePath = (next) => withNext('/select-role', null, next)
export const loginPath = (role, next) => withNext('/login', role, next)
export const registerPath = (role) => withNext('/register', role, null)
