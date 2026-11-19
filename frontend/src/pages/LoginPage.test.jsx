import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ mocks: false, api: vi.fn(), setToken: vi.fn() }))
vi.mock('../lib/api', () => ({
  get USE_MOCKS() { return h.mocks },
  api: h.api,
  setToken: h.setToken,
  getToken: () => null,
}))

import LoginPage from './LoginPage'
import { AuthProvider } from '../context/AuthContext'

function Landing({ name }) {
  const notice = useLocation().state?.roleNotice
  return <div><p>{name} landing</p>{notice && <p>{notice}</p>}</div>
}

const renderLogin = (path = '/login?role=ngo') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/select-role" element={<p>Role selector</p>} />
          <Route path="/register" element={<p>Register page</p>} />
          <Route path="/ngo" element={<Landing name="NGO" />} />
          <Route path="/provider" element={<Landing name="Provider" />} />
          <Route path="/admin" element={<Landing name="Admin" />} />
          <Route path="/ngo/reservations" element={<Landing name="Reservations" />} />
          <Route path="/" element={<p>Home landing</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.org')
  await userEvent.type(screen.getByLabelText('Password'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

const loginAs = (user, extra = {}) =>
  h.api.mockImplementation(async (path) =>
    path === '/auth/login' ? { access_token: 'tok' } : { user, profile: null, verification_status: 'approved', ...extra })

describe('role portals', () => {
  beforeEach(() => {
    h.mocks = false
    h.api.mockReset()
    h.setToken.mockReset()
    localStorage.clear()
  })

  it('sends /login with no role, or an unknown role, to the role selector', () => {
    const { unmount } = renderLogin('/login')
    expect(screen.getByText('Role selector')).toBeInTheDocument()
    unmount()
    renderLogin('/login?role=wizard')
    expect(screen.getByText('Role selector')).toBeInTheDocument()
  })

  it('keeps a safe ?next= when it falls back to the selector', () => {
    const Probe = () => <p>{useLocation().search}</p>
    render(
      <MemoryRouter initialEntries={['/login?next=%2Fngo%2Freservations']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/select-role" element={<Probe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('?next=%2Fngo%2Freservations')).toBeInTheDocument()
  })

  it('NGO portal: its own heading, subtitle, demo hint and registration link', () => {
    renderLogin('/login?role=ngo')
    expect(screen.getByRole('heading', { level: 1, name: 'NGO sign in' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to see surplus food near you and reserve it.')).toBeInTheDocument()
    expect(screen.getByLabelText('Demo account')).toHaveTextContent('ngo@agape.demo')
    expect(screen.getByLabelText('Demo account')).toHaveTextContent('Ngo@12345')
    expect(screen.getByRole('link', { name: 'Register your NGO' })).toHaveAttribute('href', '/register?role=ngo')
    expect(screen.getByText('NGO food board & reservations')).toBeInTheDocument()
  })

  it('Donor portal: its own heading, subtitle, demo hint and registration link', () => {
    renderLogin('/login?role=provider')
    expect(screen.getByRole('heading', { level: 1, name: 'Donor sign in' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to list surplus food and track your verification.')).toBeInTheDocument()
    expect(screen.getByLabelText('Demo account')).toHaveTextContent('provider@agape.demo')
    expect(screen.getByRole('link', { name: 'Register as a donor' })).toHaveAttribute('href', '/register?role=provider')
    expect(screen.getByText('Donor surplus listings')).toBeInTheDocument()
  })

  it('Admin portal: restricted copy and no registration call to action', () => {
    renderLogin('/login?role=admin')
    expect(screen.getByRole('heading', { level: 1, name: 'Admin sign in' })).toBeInTheDocument()
    expect(screen.getByText('Restricted. For the platform team only.')).toBeInTheDocument()
    expect(screen.getByText(/no public sign-up for admin accounts/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Demo account')).toHaveTextContent('admin@agape.demo')
  })

  it('every portal has a Switch role link back to the selector', () => {
    for (const role of ['ngo', 'provider', 'admin']) {
      const { unmount } = renderLogin(`/login?role=${role}`)
      expect(screen.getByRole('link', { name: 'Switch role' })).toHaveAttribute('href', '/select-role')
      unmount()
    }
  })

  it('Switch role keeps a safe ?next=', () => {
    renderLogin('/login?role=ngo&next=%2Fngo%2Freservations')
    expect(screen.getByRole('link', { name: 'Switch role' })).toHaveAttribute('href', '/select-role?next=%2Fngo%2Freservations')
  })

  it('shows the Agape brand panel with honest copy and never claims FSSAI verification', () => {
    renderLogin('/login?role=admin')
    expect(screen.getByText('Every MEAL Matters')).toBeInTheDocument()
    expect(screen.getByText(/format check plus admin review/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/FSSAI[- ]verified|FSSAI[- ]certified/i)
  })
})

describe('signing in (live backend)', () => {
  beforeEach(() => {
    h.mocks = false
    h.api.mockReset()
    h.setToken.mockReset()
    localStorage.clear()
  })

  it('posts credentials, saves the token, refreshes the session and sends an NGO to /ngo', async () => {
    loginAs({ id: 1, email: 'a@b.org', role: 'ngo', name: 'Helping Hands', phone: '+91 90000 00000' }, { profile: { lat: 28.6, lng: 77.2 } })
    renderLogin('/login?role=ngo')
    await fillAndSubmit()
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
    expect(h.api).toHaveBeenCalledWith('/auth/login', { method: 'POST', json: { email: 'a@b.org', password: 'secret123' } })
    expect(h.setToken).toHaveBeenCalledWith('tok')
    expect(screen.queryByText(/but this account/)).not.toBeInTheDocument()
  })

  it('sends a donor to /provider and an admin to /admin through their own portals', async () => {
    loginAs({ id: 2, role: 'provider' }, { verification_status: 'pending' })
    const first = renderLogin('/login?role=provider')
    await fillAndSubmit()
    expect(await screen.findByText('Provider landing')).toBeInTheDocument()
    first.unmount()

    h.api.mockReset()
    loginAs({ id: 9, role: 'admin' }, { verification_status: null })
    renderLogin('/login?role=admin')
    await fillAndSubmit()
    expect(await screen.findByText('Admin landing')).toBeInTheDocument()
  })

  it('still works if /auth/me returns a flat user (fallback)', async () => {
    h.api.mockImplementation(async (path) => (path === '/auth/login' ? { access_token: 't' } : { id: '3', role: 'ngo' }))
    renderLogin('/login?role=ngo')
    await fillAndSubmit()
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
  })

  it('redirects to the account\'s TRUE role home when it differs from the chosen portal, with a notice', async () => {
    loginAs({ id: 2, role: 'provider' }, { verification_status: 'pending' })
    renderLogin('/login?role=ngo')
    await fillAndSubmit()
    expect(await screen.findByText('Provider landing')).toBeInTheDocument()
    expect(screen.getByText('You chose NGO, but this account is a Donor account, so we opened your Donor area.')).toBeInTheDocument()
  })

  it('honours a safe ?next= when the role matches', async () => {
    loginAs({ id: 1, role: 'ngo' })
    renderLogin('/login?role=ngo&next=%2Fngo%2Freservations')
    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
    await fillAndSubmit()
    expect(await screen.findByText('Reservations landing')).toBeInTheDocument()
  })

  it('ignores ?next= when the account is a different role than the portal', async () => {
    loginAs({ id: 5, role: 'admin' })
    renderLogin('/login?role=ngo&next=%2Fngo%2Freservations')
    await fillAndSubmit()
    expect(await screen.findByText('Admin landing')).toBeInTheDocument()
    expect(screen.queryByText('Reservations landing')).not.toBeInTheDocument()
  })

  it('ignores an unsafe ?next= (open redirect) and uses the role home', async () => {
    loginAs({ id: 1, role: 'ngo' })
    renderLogin('/login?role=ngo&next=%2F%2Fevil.example.com')
    await fillAndSubmit()
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
  })

  it('shows an error and clears the token on bad credentials', async () => {
    h.api.mockRejectedValue(Object.assign(new Error('x'), { status: 401, detail: 'Bad creds' }))
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    await waitFor(() => expect(h.setToken).toHaveBeenLastCalledWith(null))
    expect(screen.queryByText('NGO landing')).not.toBeInTheDocument()
  })

  it('shows the backend detail for a disabled account (403 ACCOUNT_DISABLED)', async () => {
    h.api.mockRejectedValue(Object.assign(new Error('x'), { status: 403, code: 'ACCOUNT_DISABLED', detail: 'This account has been disabled' }))
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('This account has been disabled')
  })

  it('disables submit until both fields are filled and hides demo buttons', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.queryByText(/Continue as/)).not.toBeInTheDocument()
  })
})

describe('LoginPage (mock mode)', () => {
  beforeEach(() => {
    h.mocks = true
    h.api.mockReset()
    localStorage.clear()
  })

  it('offers one-click demo sign-in for the chosen role only and routes by role', async () => {
    renderLogin('/login?role=ngo')
    expect(screen.queryByRole('button', { name: 'Continue as Admin' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue as NGO' }))
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
    expect(h.api).not.toHaveBeenCalled()
  })

  it('signs a demo donor in and remembers the session', async () => {
    renderLogin('/login?role=provider')
    await userEvent.click(screen.getByRole('button', { name: 'Continue as Donor / Provider' }))
    expect(await screen.findByText('Provider landing')).toBeInTheDocument()
    expect(localStorage.getItem('agape_mock_role')).toBe('provider')
    expect(localStorage.getItem('agape_mock_signed_in')).toBe('1')
  })

  it('an already signed-in demo user opening another portal is sent to their own home', async () => {
    localStorage.setItem('agape_mock_role', 'admin')
    localStorage.setItem('agape_mock_signed_in', '1')
    renderLogin('/login?role=ngo')
    expect(await screen.findByText('Admin landing')).toBeInTheDocument()
  })
})
