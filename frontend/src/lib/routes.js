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
