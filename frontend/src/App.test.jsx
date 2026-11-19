import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('./lib/api', async (orig) => ({ ...(await orig()), USE_MOCKS: true }))
vi.mock('./features/ngo-reservations', () => ({
  NgoBoardPage: () => <h2>NGO board page</h2>,
  NgoReservationsPage: () => <h2>NGO reservations page</h2>,
}))

import App from './App'
import { AuthProvider } from './context/AuthContext'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )

describe('app shell', () => {
  beforeEach(() => localStorage.clear())

  it('renders the home page inside the layout', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'AGAPE' })).toBeInTheDocument()
    expect(screen.getByLabelText('Demo role')).toBeInTheDocument()
  })

  it('routes /account for a signed-in demo user and links to it from the layout', () => {
    renderAt('/account')
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
  })

  it('gives donors /provider and admins /admin, and blocks the wrong role', async () => {
    renderAt('/provider')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'provider')
    expect(screen.getByRole('heading', { level: 1, name: 'Verification' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'admin')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
  })

  it('shows /ngo for the default NGO demo user', () => {
    renderAt('/ngo')
    expect(screen.getByText('NGO board page')).toBeInTheDocument()
  })

  it('blocks /ngo/reservations for a donor and allows it again after switching to NGO', async () => {
    renderAt('/ngo/reservations')
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'provider')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'ngo')
    expect(screen.getByText('NGO reservations page')).toBeInTheDocument()
  })
})
