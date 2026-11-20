import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Demo mode, but with the real mock API: the overview and the verification queue read the same store.
vi.mock('../../lib/api', async (orig) => ({ ...(await orig()), USE_MOCKS: true }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'mock-admin', role: 'admin' } }) }))

let AdminDashboard
let AdminVerificationsPage
let AdminUsers
let verificationApi

beforeEach(async () => {
  vi.resetModules()
  ;({ AdminDashboard, AdminUsers } = await import('./index'))
  ;({ AdminVerificationsPage } = await import('../verification'))
  verificationApi = await import('../verification/api')
})

const card = (title) => screen.getByText(title).closest('article')
const pendingCounts = async () => {
  await screen.findByText('Pending NGOs')
  return [within(card('Pending NGOs')).getByText(/^\d+$/).textContent, within(card('Pending donors')).getByText(/^\d+$/).textContent]
}

describe('admin overview and verification queue stay in sync (demo mode)', () => {
  it('shows 1 pending NGO and 1 pending donor at first', async () => {
    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['1', '1'])
  })

  it('approving both pending requests brings PENDING NGOS and PENDING DONORS down to 0 on the overview', async () => {
    const queue = render(<AdminVerificationsPage />)
    const approve = await screen.findAllByRole('button', { name: 'Approve' })
    expect(approve).toHaveLength(2)
    await userEvent.click(approve[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Approve' })).toHaveLength(0))
    queue.unmount()

    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['0', '0'])
  })

  it('rejecting clears the counts too', async () => {
    const queue = render(<AdminVerificationsPage />)
    for (let i = 0; i < 2; i++) {
      await userEvent.click((await screen.findAllByRole('button', { name: 'Reject' }))[0])
      const dialog = await screen.findByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText(/Rejection reason/), 'Not enough detail')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Reject' })).toHaveLength(0))
    queue.unmount()
    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['0', '0'])
  })

  it('a demo NGO and donor submitting their verification raise the counts, and approving them lowers them again', async () => {
    await verificationApi.submitNgoOnboarding({ reg_number: 'REG/9' })
    await verificationApi.submitProviderVerification({ entity_name: 'Demo Kitchen', pan: 'ABCDE1234F', aadhaar: '987654321098', fssai_number: '11112222333344' })
    const first = render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['2', '2'])
    first.unmount()

    const queue = render(<AdminVerificationsPage />)
    for (let i = 0; i < 4; i++) {
      const buttons = await screen.findAllByRole('button', { name: 'Approve' })
      await userEvent.click(buttons[0])
      await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Approve' }).length).toBe(buttons.length - 1))
    }
    queue.unmount()
    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['0', '0'])
    // and the donor and NGO now read as verified on their own pages
    expect((await verificationApi.getNgoVerification()).status).toBe('approved')
    expect((await verificationApi.getProviderVerification()).status).toBe('approved')
  })

  it('deleting a pending account on the users page lowers the overview', async () => {
    const users = render(<MemoryRouter><AdminUsers /></MemoryRouter>)
    const row = (await screen.findByText('asha@ngo.demo', { selector: 'td' })).closest('tr')
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.queryByText('asha@ngo.demo', { selector: 'td' })).not.toBeInTheDocument())
    users.unmount()
    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['0', '1'])
  })

  it('Reset demo accounts takes both counts to 0 and leaves only the admin in the total', async () => {
    const users = render(<MemoryRouter><AdminUsers /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Reset demo accounts' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete all accounts' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset demo accounts' })).toBeDisabled())
    users.unmount()
    render(<AdminDashboard />)
    expect(await pendingCounts()).toEqual(['0', '0'])
    expect(within(card('Total users')).getByText('1')).toBeInTheDocument()
  })
})
