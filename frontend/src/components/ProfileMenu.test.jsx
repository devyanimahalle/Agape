import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ logout: vi.fn(), user: { id: 1, name: 'Helping Hands', role: 'ngo' } }))
vi.mock('../context/AuthContext', () => ({
  ROLE_LABEL: { provider: 'Donor', ngo: 'NGO', admin: 'Admin' },
  useAuth: () => ({ user: h.user, logout: h.logout }),
}))

import ProfileMenu from './ProfileMenu'

const setup = () =>
  render(
    <MemoryRouter initialEntries={['/ngo']}>
      <ProfileMenu />
      <Routes>
        <Route path="/" element={<p>Public home</p>} />
        <Route path="/account" element={<p>Account page</p>} />
        <Route path="*" element={<p>Somewhere</p>} />
      </Routes>
      <button>Outside</button>
    </MemoryRouter>,
  )

const toggle = () => screen.getByRole('button', { name: 'Profile menu' })

beforeEach(() => {
  h.logout.mockClear()
  h.user = { id: 1, name: 'Helping Hands', role: 'ngo' }
})

describe('ProfileMenu', () => {
  it('is a labelled button showing the initials, with the menu closed', () => {
    setup()
    expect(toggle()).toHaveTextContent('HH')
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('falls back to the role label when there is no name', () => {
    h.user = { id: 2, role: 'admin' }
    setup()
    expect(toggle()).toHaveTextContent('AD')
  })

  it('opens a menu with exactly Account and Sign out', async () => {
    setup()
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual(['Account', 'Sign out'])
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveAttribute('href', '/account')
  })

  it('moves focus into the menu and supports the arrow keys', async () => {
    setup()
    await userEvent.click(toggle())
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveFocus()
  })

  it('Account navigates to /account and closes the menu', async () => {
    setup()
    await userEvent.click(toggle())
    await userEvent.click(screen.getByRole('menuitem', { name: 'Account' }))
    expect(screen.getByText('Account page')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Sign out signs out, goes to / and closes the menu', async () => {
    setup()
    await userEvent.click(toggle())
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(h.logout).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Public home')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the button', async () => {
    setup()
    await userEvent.click(toggle())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(toggle()).toHaveFocus()
  })

  it('closes on an outside click', async () => {
    setup()
    await userEvent.click(toggle())
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('toggles closed when the button is pressed again', async () => {
    setup()
    await userEvent.click(toggle())
    await userEvent.click(toggle())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders nothing when signed out', () => {
    h.user = null
    setup()
    expect(screen.queryByRole('button', { name: 'Profile menu' })).not.toBeInTheDocument()
  })
})
