import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../context/AuthContext'
import VerificationGate from './VerificationGate'

const refresh = vi.fn(() => Promise.resolve())
const as = (over) => useAuth.mockReturnValue({ mock: false, verificationStatus: 'pending', refresh, ...over })
const renderGate = (role) =>
  render(
    <MemoryRouter>
      <VerificationGate role={role}><p>Protected content</p></VerificationGate>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VerificationGate', () => {
  it('lets an approved account through and does not refresh the session', () => {
    as({ verificationStatus: 'approved' })
    renderGate('ngo')
    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('lets demo mode through', () => {
    as({ mock: true, verificationStatus: null })
    renderGate('provider')
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it.each(['pending', 'rejected', null])('blocks an NGO with status %s and points to onboarding', (status) => {
    as({ verificationStatus: status })
    renderGate('ngo')
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Verification needed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to NGO onboarding' })).toHaveAttribute('href', '/ngo/onboarding')
  })

  it('blocks every donor, whatever the category, and points to /provider', () => {
    as({ verificationStatus: 'pending', profile: { category: 'general' } })
    renderGate('provider')
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to verification' })).toHaveAttribute('href', '/provider')
  })

  it('says a rejected request can be resubmitted', () => {
    as({ verificationStatus: 'rejected' })
    renderGate('provider')
    expect(screen.getByText(/was not approved/i)).toBeInTheDocument()
  })

  it('re-reads the session once so an approval made meanwhile unlocks the page', () => {
    as()
    renderGate('ngo')
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
