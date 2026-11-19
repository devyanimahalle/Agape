import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
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

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/ngo" element={<p>NGO landing</p>} />
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

describe('LoginPage (live backend)', () => {
  beforeEach(() => {
    h.mocks = false
    h.api.mockReset()
    h.setToken.mockReset()
    localStorage.clear()
  })

  it('posts credentials, saves the token, refreshes the session and sends an NGO to /ngo', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/login'
        ? { access_token: 'tok-1' }
        : { user: { id: 1, email: 'a@b.org', role: 'ngo', name: 'Helping Hands', phone: '+91 90000 00000' },
            profile: { lat: 28.6, lng: 77.2 }, verification_status: 'approved' })
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
    expect(h.api).toHaveBeenCalledWith('/auth/login', { method: 'POST', json: { email: 'a@b.org', password: 'secret123' } })
    expect(h.setToken).toHaveBeenCalledWith('tok-1')
  })

  it('sends non-NGO users to / (nested /auth/me shape)', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/login'
        ? { access_token: 'tok-2' }
        : { user: { id: 2, role: 'provider' }, profile: null, verification_status: 'pending' })
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByText('Home landing')).toBeInTheDocument()
  })

  it('still works if /auth/me returns a flat user (fallback)', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/login' ? { access_token: 'tok-3' } : { id: '3', role: 'ngo' })
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
  })

  it('sends a flat provider to / (fallback)', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/login' ? { access_token: 'tok-4' } : { id: '4', role: 'provider' })
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByText('Home landing')).toBeInTheDocument()
  })

  it('shows an error and clears the token on bad credentials', async () => {
    h.api.mockRejectedValue(Object.assign(new Error('x'), { status: 401, detail: 'Bad creds' }))
    renderLogin()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    await waitFor(() => expect(h.setToken).toHaveBeenLastCalledWith(null))
    expect(screen.queryByText('NGO landing')).not.toBeInTheDocument()
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

  it('offers one-click demo sign-in and routes by role', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Continue as NGO' }))
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
    expect(h.api).not.toHaveBeenCalled()
  })

  it('sends a demo donor to / and remembers the role', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Continue as Donor' }))
    expect(await screen.findByText('Home landing')).toBeInTheDocument()
    expect(localStorage.getItem('agape_mock_role')).toBe('provider')
    expect(screen.queryByText('NGO landing')).not.toBeInTheDocument()
  })
})
