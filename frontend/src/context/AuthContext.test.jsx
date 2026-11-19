import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../lib/api', () => ({
  USE_MOCKS: false,
  api: h.api,
  setToken: vi.fn(),
  getToken: () => 'tok',
}))

import { AuthProvider, useAuth, parseMe } from './AuthContext'

function Probe() {
  const { user, profile, verificationStatus, loading } = useAuth()
  if (loading) return <p>loading</p>
  return (
    <ul>
      <li>role:{user?.role ?? 'none'}</li>
      <li>name:{user?.name ?? 'none'}</li>
      <li>lat:{profile?.lat ?? 'none'}</li>
      <li>status:{verificationStatus ?? 'none'}</li>
    </ul>
  )
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>)

describe('AuthContext /auth/me parsing', () => {
  beforeEach(() => h.api.mockReset())

  it('unwraps data.user and keeps profile and verification_status', async () => {
    h.api.mockResolvedValue({
      user: { id: 1, email: 'n@x.org', role: 'ngo', name: 'Helping Hands', phone: '+91 90000 00000' },
      profile: { lat: 28.6139, lng: 77.209, org_name: 'Helping Hands' },
      verification_status: 'approved',
    })
    mount()
    expect(await screen.findByText('role:ngo')).toBeInTheDocument()
    expect(screen.getByText('name:Helping Hands')).toBeInTheDocument()
    expect(screen.getByText('lat:28.6139')).toBeInTheDocument()
    expect(screen.getByText('status:approved')).toBeInTheDocument()
    expect(h.api).toHaveBeenCalledWith('/auth/me')
  })

  it('falls back to a flat response when data.user is absent', async () => {
    h.api.mockResolvedValue({ id: 2, role: 'provider', name: 'Cafe', profile: { lat: 1 } })
    mount()
    expect(await screen.findByText('role:provider')).toBeInTheDocument()
    expect(screen.getByText('lat:1')).toBeInTheDocument()
    expect(screen.getByText('status:none')).toBeInTheDocument()
  })

  it('parseMe handles a null profile (admin)', () => {
    expect(parseMe({ user: { id: 3, role: 'admin' }, profile: null, verification_status: null })).toEqual({
      user: { id: 3, role: 'admin' },
      profile: null,
      verificationStatus: null,
    })
  })
})
