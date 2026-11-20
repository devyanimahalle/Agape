import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ mocks: false, api: vi.fn(), setToken: vi.fn() }))
vi.mock('../lib/api', () => ({
  get USE_MOCKS() { return h.mocks },
  api: h.api,
  setToken: h.setToken,
  getToken: () => null,
}))

import RegisterPage from './RegisterPage'
import { AuthProvider } from '../context/AuthContext'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/select-role" element={<p>Role selector</p>} />
          <Route path="/ngo" element={<p>NGO landing</p>} />
          <Route path="/provider" element={<p>Provider landing</p>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

async function fillCommon() {
  await userEvent.type(screen.getByLabelText(/Your name/), 'Asha Rao')
  await userEvent.type(screen.getByLabelText(/Phone/), '+91 90000 00000')
  await userEvent.type(screen.getByLabelText(/Email/), 'asha@example.org')
  await userEvent.type(screen.getByLabelText(/Password/), 'Password1!')
  await userEvent.type(screen.getByLabelText(/Address/), 'Karol Bagh, Delhi')
  await userEvent.type(screen.getByLabelText(/Latitude/), '28.65')
  await userEvent.type(screen.getByLabelText(/Longitude/), '77.19')
}

beforeEach(() => {
  h.mocks = false
  h.api.mockReset()
  h.setToken.mockReset()
  localStorage.clear()
})

describe('RegisterPage', () => {
  it('sends a missing or admin role back to the selector (admins never self-register)', () => {
    const a = renderAt('/register')
    expect(screen.getByText('Role selector')).toBeInTheDocument()
    a.unmount()
    renderAt('/register?role=admin')
    expect(screen.getByText('Role selector')).toBeInTheDocument()
  })

  it('NGO form asks for the registration number and posts the NGO payload, then signs in', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/register' ? { access_token: 'tok' } : { user: { id: 1, role: 'ngo', name: 'Asha Rao' }, profile: null, verification_status: 'pending' })
    renderAt('/register?role=ngo')
    expect(screen.getByRole('heading', { level: 1, name: 'Register your NGO' })).toBeInTheDocument()
    await fillCommon()
    await userEvent.type(screen.getByLabelText(/Organisation name/), 'Helping Hands')
    await userEvent.type(screen.getByLabelText(/Registration number/), 'REG/1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('NGO landing')).toBeInTheDocument()
    expect(h.api).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      json: expect.objectContaining({ role: 'ngo', email: 'asha@example.org', org_name: 'Helping Hands', reg_number: 'REG/1', lat: 28.65, lng: 77.19 }),
    })
    expect(h.setToken).toHaveBeenCalledWith('tok')
  })

  it('donor form asks for the kind of donor, including home kitchens', async () => {
    h.api.mockImplementation(async (path) =>
      path === '/auth/register' ? { access_token: 'tok' } : { user: { id: 2, role: 'provider', name: 'Asha Rao' }, profile: null, verification_status: 'pending' })
    renderAt('/register?role=provider')
    expect(screen.getByRole('heading', { level: 1, name: 'Register as a donor' })).toBeInTheDocument()
    await fillCommon()
    await userEvent.type(screen.getByLabelText(/Business name/), 'Asha Kitchen')
    await userEvent.selectOptions(screen.getByLabelText(/Kind of donor/), 'general')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Provider landing')).toBeInTheDocument()
    expect(h.api.mock.calls[0][1].json).toMatchObject({ role: 'provider', category: 'general', org_name: 'Asha Kitchen' })
  })

  it('explains what is missing and sends nothing', async () => {
    renderAt('/register?role=ngo')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Enter your name')).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument()
    expect(screen.getByText('Enter your registration number')).toBeInTheDocument()
    expect(screen.getByText(/Latitude must be between/)).toBeInTheDocument()
    expect(h.api).not.toHaveBeenCalled()
  })

  it('shows the server message, for example a duplicate email', async () => {
    h.api.mockRejectedValue(Object.assign(new Error('x'), { status: 409, detail: 'An account with this email already exists' }))
    renderAt('/register?role=ngo')
    await fillCommon()
    await userEvent.type(screen.getByLabelText(/Organisation name/), 'Helping Hands')
    await userEvent.type(screen.getByLabelText(/Registration number/), 'REG/1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists')
  })

  it('in demo mode points at the demo sign-in instead of the form', () => {
    h.mocks = true
    renderAt('/register?role=provider')
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Donor / Provider sign in' })).toHaveAttribute('href', '/login?role=provider')
  })
})
