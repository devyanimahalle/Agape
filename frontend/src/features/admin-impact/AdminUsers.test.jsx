import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api')
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import * as api from './api'
import { useAuth } from '../../context/AuthContext'
import AdminUsers from './AdminUsers'

const user = (over) => ({ is_active: true, phone: null, created_at: '2026-01-01T00:00:00Z', ...over })
const USERS = [
  user({ id: 1, email: 'admin@x.com', role: 'admin', name: 'Boss Admin', profile: null }),
  user({ id: 2, email: 'donor@x.com', role: 'provider', name: 'Fresh Kitchen', profile: { org_name: 'Fresh Kitchen', category: 'restaurant', verification_status: 'approved' } }),
  user({ id: 3, email: 'ngo@x.com', role: 'ngo', name: 'Helpers', profile: { org_name: 'Helpers', status: 'pending' } }),
]

// The page renders a table (md and up) and a card list (below md); jsdom shows both, so query within the table.
const table = () => within(screen.getByRole('table'))

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 1, role: 'admin' } })
  api.fetchUsers.mockResolvedValue(structuredClone(USERS))
})

describe('delete controls', () => {
  it('offers Delete for donors and NGOs but never for admins or yourself', async () => {
    render(<AdminUsers />)
    await screen.findByRole('table')
    const row = (email) => table().getByText(email).closest('tr')
    expect(within(row('donor@x.com')).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(row('ngo@x.com')).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(row('admin@x.com')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('asks before deleting, then removes the row', async () => {
    api.deleteUser.mockResolvedValue({ deleted: 1 })
    render(<AdminUsers />)
    await screen.findByRole('table')
    await userEvent.click(within(table().getByText('ngo@x.com').closest('tr')).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete Helpers?' })).toBeInTheDocument()
    expect(api.deleteUser).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith(3))
    await waitFor(() => expect(table().queryByText('ngo@x.com')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelling does nothing', async () => {
    render(<AdminUsers />)
    await screen.findByRole('table')
    await userEvent.click(within(table().getByText('ngo@x.com').closest('tr')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(api.deleteUser).not.toHaveBeenCalled()
    expect(table().getByText('ngo@x.com')).toBeInTheDocument()
  })

  it('keeps the row and shows the error when the server refuses', async () => {
    api.deleteUser.mockRejectedValue(new Error('boom'))
    render(<AdminUsers />)
    await screen.findByRole('table')
    await userEvent.click(within(table().getByText('ngo@x.com').closest('tr')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByText(/Failed to delete: boom/)).toBeInTheDocument()
    expect(table().getByText('ngo@x.com')).toBeInTheDocument()
  })
})

describe('Reset demo accounts', () => {
  it('confirms, deletes every non-admin account and keeps the admin', async () => {
    api.resetAccounts.mockResolvedValue({ deleted: 2 })
    render(<AdminUsers />)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo accounts' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/all 2 donor and NGO accounts/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Admin accounts are kept/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete all accounts' }))
    await waitFor(() => expect(api.resetAccounts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(table().queryByText('donor@x.com')).not.toBeInTheDocument())
    expect(table().getByText('admin@x.com')).toBeInTheDocument()
  })

  it('is disabled when there is nothing to reset', async () => {
    api.fetchUsers.mockResolvedValue([USERS[0]])
    render(<AdminUsers />)
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Reset demo accounts' })).toBeDisabled()
  })
})
