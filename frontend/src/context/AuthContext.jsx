import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, getToken, USE_MOCKS } from '../lib/api'

// Backend roles (see backend/app/reservations/deps.py): "ngo" and "provider" (donor). "admin" is for review screens.
export const ROLES = ['provider', 'ngo', 'admin']
export const ROLE_LABEL = { provider: 'Donor', ngo: 'NGO', admin: 'Admin' }
const MOCK_KEY = 'agape_mock_role'

const MOCK_USERS = {
  provider: { id: 'mock-provider', name: 'Demo Donor', role: 'provider' },
  ngo: { id: 'mock-ngo', name: 'Demo NGO', role: 'ngo' },
  admin: { id: 'mock-admin', name: 'Demo Admin', role: 'admin' },
}

const AuthContext = createContext(null)
const EMPTY = { user: null, profile: null, verificationStatus: null }

// /auth/me returns { user, profile, verification_status }. Fall back to a flat user object if `user` is absent.
export function parseMe(data) {
  const user = data?.user ?? data ?? null
  return {
    user,
    profile: data?.profile ?? user?.profile ?? null,
    verificationStatus: data?.verification_status ?? null,
  }
}

function readMockRole() {
  try {
    const r = localStorage.getItem(MOCK_KEY)
    return ROLES.includes(r) ? r : 'ngo'
  } catch {
    return 'ngo'
  }
}

export function AuthProvider({ children }) {
  const [mockRole, setMockRoleState] = useState(readMockRole)
  const [session, setSession] = useState(EMPTY)
  const [loading, setLoading] = useState(!USE_MOCKS)

  useEffect(() => {
    if (USE_MOCKS) return
    if (!getToken()) {
      setLoading(false)
      return
    }
    let live = true
    api('/auth/me')
      .then((data) => live && setSession(parseMe(data)))
      .catch(() => {
        if (live) {
          setToken(null)
          setSession(EMPTY)
        }
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  const setMockRole = useCallback((r) => {
    if (!ROLES.includes(r)) return
    setMockRoleState(r)
    try { localStorage.setItem(MOCK_KEY, r) } catch { /* ignore */ }
  }, [])

  // Re-read the session from /auth/me (call after setToken() on login). Returns the user.
  const refresh = useCallback(async () => {
    const next = parseMe(await api('/auth/me'))
    setSession(next)
    return next.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setSession(EMPTY)
  }, [])

  const value = useMemo(
    () => ({
      user: USE_MOCKS ? MOCK_USERS[mockRole] : session.user,
      profile: USE_MOCKS ? null : session.profile,
      verificationStatus: USE_MOCKS ? null : session.verificationStatus,
      loading: USE_MOCKS ? false : loading,
      mock: USE_MOCKS,
      mockRole,
      setMockRole,
      refresh,
      logout,
    }),
    [session, loading, mockRole, setMockRole, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
