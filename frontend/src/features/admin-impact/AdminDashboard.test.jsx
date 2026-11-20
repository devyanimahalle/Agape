import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api')

import * as api from './api'
import AdminDashboard from './AdminDashboard'

const stats = (o = {}) => ({
  total_users: 5, ngos_pending: 2, providers_pending: 1,
  listings_by_status: { listed: 1, reserved: 0, completed: 2, cancelled: 0, expired: 0 }, ...o,
})
const value = (title) => within(screen.getByText(title).closest('article')).getByText(/^\d+$/).textContent

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchStats.mockResolvedValue(stats())
})

describe('AdminDashboard pending counts', () => {
  it('shows the counts the API reports, and reads them fresh each time it opens', async () => {
    const first = render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    expect([value('Pending NGOs'), value('Pending donors')]).toEqual(['2', '1'])
    first.unmount()

    api.fetchStats.mockResolvedValue(stats({ ngos_pending: 0, providers_pending: 0 }))
    render(<AdminDashboard />)
    await waitFor(() => expect([value('Pending NGOs'), value('Pending donors')]).toEqual(['0', '0']))
    expect(api.fetchStats).toHaveBeenCalledTimes(2)
  })

  it('shows 0 when nothing is pending', async () => {
    api.fetchStats.mockResolvedValue(stats({ ngos_pending: 0, providers_pending: 0 }))
    render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    expect([value('Pending NGOs'), value('Pending donors')]).toEqual(['0', '0'])
  })

  it('refreshes the counts when the tab regains focus, without showing a loading state again', async () => {
    render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    api.fetchStats.mockResolvedValue(stats({ ngos_pending: 0, providers_pending: 0 }))
    await act(async () => { fireEvent.focus(window) })
    await waitFor(() => expect([value('Pending NGOs'), value('Pending donors')]).toEqual(['0', '0']))
    expect(screen.queryByText('Loading dashboard…')).not.toBeInTheDocument()
  })

  it('refreshes when the page becomes visible again', async () => {
    render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    api.fetchStats.mockResolvedValue(stats({ ngos_pending: 3 }))
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(value('Pending NGOs')).toBe('3'))
  })

  it('keeps the last good numbers if a background refresh fails', async () => {
    render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    api.fetchStats.mockRejectedValue(new Error('offline'))
    await act(async () => { fireEvent.focus(window) })
    expect(value('Pending NGOs')).toBe('2')
    expect(screen.queryByText('Failed to load dashboard')).not.toBeInTheDocument()
  })

  it('stops listening when it unmounts', async () => {
    const { unmount } = render(<AdminDashboard />)
    await screen.findByText('Pending NGOs')
    unmount()
    api.fetchStats.mockClear()
    fireEvent.focus(window)
    expect(api.fetchStats).not.toHaveBeenCalled()
  })

  it('still shows an error when the first load fails', async () => {
    api.fetchStats.mockRejectedValue(new Error('boom'))
    render(<AdminDashboard />)
    expect(await screen.findByText('Failed to load dashboard')).toBeInTheDocument()
  })
})
