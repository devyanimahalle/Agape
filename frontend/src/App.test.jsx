import { render, screen, within } from '@testing-library/react'
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

// Demo mode keeps its session in localStorage; these helpers start a test signed in as a role (or signed out).
const signInAs = (role) => {
  localStorage.setItem('agape_mock_role', role)
  localStorage.setItem('agape_mock_signed_in', '1')
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )

const navLinks = () => within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])

beforeEach(() => localStorage.clear())

describe('signed-out visitor', () => {
  it('sees the landing page with Impact and a Sign in link to the role selector', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'AGAPE' })).toBeInTheDocument()
    expect(navLinks()).toEqual([['Impact', '/impact']])
    const signIn = within(screen.getAllByRole('banner')[0]).getByRole('link', { name: 'Sign in' })
    expect(signIn).toHaveAttribute('href', '/select-role')
    expect(screen.queryByRole('button', { name: 'Profile menu' })).not.toBeInTheDocument()
  })

  it('is asked to sign in when opening a protected page, with that role\'s portal', () => {
    renderAt('/ngo')
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in required' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?role=ngo&next=%2Fngo')
  })

  it('can open the public Impact page', () => {
    renderAt('/impact')
    expect(screen.getByRole('heading', { level: 1, name: 'Impact' })).toBeInTheDocument()
  })
})

describe('signed-in users never see the public landing page', () => {
  it.each([
    ['ngo', 'NGO board page'],
    ['provider', 'Verification'],
    ['admin', 'Admin'],
  ])('%s opening / is sent to their home', async (role, marker) => {
    signInAs(role)
    renderAt('/')
    expect(screen.queryByRole('heading', { level: 1, name: 'AGAPE' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: marker })).toBeInTheDocument()
  })

  it('is also sent home from the role selector', async () => {
    signInAs('ngo')
    renderAt('/select-role')
    expect(await screen.findByText('NGO board page')).toBeInTheDocument()
  })

  it('the AGAPE logo points to the role home when signed in, and to / when signed out', () => {
    signInAs('provider')
    const { unmount } = renderAt('/account')
    expect(screen.getByRole('link', { name: 'Agape' })).toHaveAttribute('href', '/provider')
    unmount()
    localStorage.clear()
    renderAt('/impact')
    expect(screen.getByRole('link', { name: 'Agape' })).toHaveAttribute('href', '/')
  })

  it('can reach the landing page again after signing out', async () => {
    signInAs('ngo')
    renderAt('/ngo')
    await userEvent.click(screen.getByRole('button', { name: 'Profile menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'AGAPE' })).toBeInTheDocument()
    expect(localStorage.getItem('agape_mock_signed_in')).toBeNull()
  })
})

describe('strict per-role navigation', () => {
  it('NGO sees only NGO links plus Impact', () => {
    signInAs('ngo')
    renderAt('/account')
    expect(navLinks()).toEqual([
      ['Food board', '/ngo'],
      ['My reservations', '/ngo/reservations'],
      ['Onboarding', '/ngo/onboarding'],
      ['Impact', '/impact'],
    ])
  })

  it('Provider sees only donor links plus Impact', () => {
    signInAs('provider')
    renderAt('/account')
    expect(navLinks()).toEqual([
      ['Verification', '/provider'],
      ['Listings', '/provider/listings'],
      ['Impact', '/impact'],
    ])
  })

  it('Admin sees only admin links plus Impact', () => {
    signInAs('admin')
    renderAt('/account')
    expect(navLinks()).toEqual([
      ['Dashboard', '/admin'],
      ['Verifications', '/admin/verifications'],
      ['Proofs', '/admin/proofs'],
      ['Users', '/admin/users'],
      ['Impact', '/impact'],
    ])
  })

  it.each(['ngo', 'provider', 'admin'])('%s has no standalone Account link or Sign out button in the bar', (role) => {
    signInAs(role)
    renderAt('/impact')
    const hrefs = navLinks().map(([, href]) => href)
    expect(hrefs).not.toContain('/account')
    expect(within(screen.getAllByRole('banner')[0]).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile menu' })).toBeInTheDocument()
  })

  it('switching the demo role changes the links', async () => {
    signInAs('ngo')
    renderAt('/account')
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'admin')
    expect(navLinks().map(([t]) => t)).toEqual(['Dashboard', 'Verifications', 'Proofs', 'Users', 'Impact'])
  })
})

describe('role-gated pages', () => {
  it('routes /account for a signed-in demo user', () => {
    signInAs('ngo')
    renderAt('/account')
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
  })

  it('gives donors /provider and admins /admin, and blocks the wrong role', async () => {
    signInAs('ngo')
    renderAt('/provider')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'provider')
    expect(screen.getByRole('heading', { level: 1, name: 'Verification' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'admin')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
  })

  it('shows /ngo for an NGO demo user', () => {
    signInAs('ngo')
    renderAt('/ngo')
    expect(screen.getByText('NGO board page')).toBeInTheDocument()
  })

  it('blocks /ngo/reservations for a donor and allows it again after switching to NGO', async () => {
    signInAs('ngo')
    renderAt('/ngo/reservations')
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'provider')
    expect(screen.getByText(/Not available for your role/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Demo role'), 'ngo')
    expect(screen.getByText('NGO reservations page')).toBeInTheDocument()
  })
})
