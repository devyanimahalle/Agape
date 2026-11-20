import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, getToken, USE_MOCKS } from '../lib/api'

// Backend roles (see backend/app/reservations/deps.py): "ngo" and "provider" (donor). "admin" is for review screens.
export const ROLES = ['provider', 'ngo', 'admin']
export const ROLE_LABEL = { provider: 'Donor', ngo: 'NGO', admin: 'Admin' }
const MOCK_KEY = 'agape_mock_role'
const MOCK_SIGNED_IN_KEY = 'agape_mock_signed_in'

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

// Demo mode has a real signed-in/out state too, so the public landing page and the sign-in flow can be shown.
function readMockSignedIn() {
  try {
    return localStorage.getItem(MOCK_SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [mockRole, setMockRoleState] = useState(readMockRole)
  const [mockSignedIn, setMockSignedIn] = useState(readMockSignedIn)
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

  // Demo mode: sign in as this role (the real equivalent is login + refresh()).
  const mockSignIn = useCallback((r) => {
    if (!ROLES.includes(r)) return
    setMockRoleState(r)
    setMockSignedIn(true)
    try {
      localStorage.setItem(MOCK_KEY, r)
      localStorage.setItem(MOCK_SIGNED_IN_KEY, '1')
    } catch { /* ignore */ }
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
    setMockSignedIn(false)
    try { localStorage.removeItem(MOCK_SIGNED_IN_KEY) } catch { /* ignore */ }
  }, [])

  const value = useMemo(
    () => ({
      user: USE_MOCKS ? (mockSignedIn ? MOCK_USERS[mockRole] : null) : session.user,
      profile: USE_MOCKS ? null : session.profile,
      verificationStatus: USE_MOCKS ? null : session.verificationStatus,
      loading: USE_MOCKS ? false : loading,
      mock: USE_MOCKS,
      mockRole,
      setMockRole,
      mockSignIn,
      refresh,
      logout,
    }),
    [session, loading, mockRole, mockSignedIn, setMockRole, mockSignIn, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
