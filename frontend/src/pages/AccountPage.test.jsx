import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ auth: {} }))
vi.mock('../context/AuthContext', async (orig) => ({ ...(await orig()), useAuth: () => h.auth }))

import AccountPage from './AccountPage'

const ngo = {
  user: { id: 7, email: 'ngo@x.org', role: 'ngo', name: 'Helping Hands', phone: '+91 90000 00000' },
  profile: { org_name: 'Helping Hands Trust', address: '12 MG Road', lat: 28.6139, lng: 77.209 },
  verificationStatus: 'approved',
  mock: false,
}

describe('AccountPage', () => {
  beforeEach(() => { h.auth = {} })

  it('shows session details, role badge, profile and an approved NGO as admin-verified', () => {
    h.auth = ngo
    render(<AccountPage />)
    expect(screen.getByRole('heading', { name: 'Helping Hands', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('NGO')).toBeInTheDocument()
    expect(screen.getByText('ngo@x.org')).toBeInTheDocument()
    expect(screen.getByText('+91 90000 00000')).toBeInTheDocument()
    expect(screen.getByText('Admin-verified')).toBeInTheDocument()
    expect(screen.getByText('Helping Hands Trust')).toBeInTheDocument()
    expect(screen.getByText('28.6139, 77.2090')).toBeInTheDocument()
  })

  it('shows a pending donor as awaiting admin review', () => {
    h.auth = { user: { id: 2, role: 'provider', name: 'Cafe' }, profile: { category: 'restaurant' }, verificationStatus: 'pending', mock: false }
    render(<AccountPage />)
    expect(screen.getByText('Donor')).toBeInTheDocument()
    expect(screen.getByText('Awaiting admin review')).toBeInTheDocument()
    expect(screen.getByText('restaurant')).toBeInTheDocument()
  })

  it('admin without a profile sees "not applicable" and no organisation card', () => {
    h.auth = { user: { id: 1, role: 'admin', name: 'Site Owner' }, profile: null, verificationStatus: null, mock: false }
    render(<AccountPage />)
    expect(screen.getByText('Admin')).toBeInTheDocument() // role badge
    expect(screen.getByText('Not applicable for admin accounts.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Organisation')).not.toBeInTheDocument()
  })

  it('labels the demo session honestly and never claims FSSAI verification', () => {
    h.auth = { user: { id: 'mock-ngo', role: 'ngo', name: 'Demo NGO' }, profile: null, verificationStatus: null, mock: true }
    render(<AccountPage />)
    expect(screen.getByText(/sample session, not a real account/)).toBeInTheDocument()
    expect(screen.getByText('No verification status is available.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/FSSAI[- ]verified/i)
  })

  it('renders nothing when signed out', () => {
    h.auth = { user: null }
    const { container } = render(<AccountPage />)
    expect(container).toBeEmptyDOMElement()
  })
})
