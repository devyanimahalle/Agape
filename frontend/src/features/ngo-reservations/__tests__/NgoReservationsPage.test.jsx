import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import NgoReservationsPage from '../NgoReservationsPage'
import { apiError, reservation } from './fixtures'

vi.mock('../api')

function ProofStub() {
  const { pathname, state } = useLocation()
  return <p>Proof page {pathname} {state?.justConfirmed ? '(just confirmed)' : ''}</p>
}

const renderPage = (entry = '/ngo/reservations') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/ngo/reservations" element={<NgoReservationsPage />} />
        <Route path="/ngo/pickups/:id/proof" element={<ProofStub />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.resetAllMocks()
  api.getReservations.mockResolvedValue([reservation({ id: 1, title: 'Veg biryani' })])
})

describe('NgoReservationsPage', () => {
  it('lists reservations with To collect actions: Confirm pickup and Cancel reservation', async () => {
    renderPage()
    const card = await screen.findByRole('article')
    expect(within(card).getByRole('button', { name: 'Confirm pickup' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Cancel reservation' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Complete pickup' })).not.toBeInTheDocument()
  })

  it('filters by status tab', async () => {
    renderPage()
    await screen.findByRole('article')
    await userEvent.click(screen.getByRole('tab', { name: 'Completed' }))
    await waitFor(() => expect(api.getReservations).toHaveBeenLastCalledWith('completed'))
  })

  it('cancels only after confirmation', async () => {
    api.cancelReservation.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel reservation' }))
    expect(api.cancelReservation).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel reservation' }))
    await waitFor(() => expect(api.cancelReservation).toHaveBeenCalledWith(1))
    expect(await screen.findByRole('status')).toHaveTextContent(/Cancelled/)
  })

  it('confirms a pickup in one click, with no file input, then goes to the Proof of donation page', async () => {
    api.completePickup.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm pickup' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm pickup?' })
    expect(dialog.querySelector('input[type="file"]')).toBeNull() // nothing to upload at pickup
    expect(within(dialog).getByText(/You will add proof of donation next/)).toBeInTheDocument()
    expect(api.completePickup).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm pickup' }))
    await waitFor(() => expect(api.completePickup).toHaveBeenCalledWith(1))
    expect(api.completePickup.mock.calls[0]).toHaveLength(1) // just the id: no files, no note
    expect(await screen.findByText('Proof page /ngo/pickups/1/proof (just confirmed)')).toBeInTheDocument()
  })

  it('stays on the page and shows the error if confirming fails', async () => {
    api.completePickup.mockRejectedValue(apiError(409, 'INVALID_STATE', 'Only a reserved listing can be completed'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm pickup' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm pickup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only a reserved listing/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/Proof page/)).not.toBeInTheDocument()
  })

  it('does not confirm when the dialog is dismissed', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm pickup' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Not now' }))
    expect(api.completePickup).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers Upload proof of donation on collected pickups that still need proof, and links to the proof page', async () => {
    api.getReservations.mockResolvedValue([
      reservation({ id: 1, title: 'A', status: 'completed', proof_status: 'none' }),
      reservation({ id: 2, title: 'B', status: 'completed', proof_status: 'rejected' }),
      reservation({ id: 3, title: 'C', status: 'completed', proof_status: 'pending', proof_count: 1 }),
      reservation({ id: 4, title: 'D', status: 'completed', proof_status: 'approved', proof_count: 1 }),
    ])
    renderPage()
    const [a, b, c, d] = await screen.findAllByRole('article')
    expect(within(a).getByRole('link', { name: 'Upload proof of donation' })).toHaveAttribute('href', '/ngo/pickups/1/proof')
    expect(within(a).getByText('Needed')).toBeInTheDocument()
    expect(within(b).getByRole('link', { name: 'Upload proof of donation' })).toHaveAttribute('href', '/ngo/pickups/2/proof')
    expect(within(b).getByText(/Not approved, upload again/)).toBeInTheDocument()
    expect(within(c).queryByRole('link', { name: 'Upload proof of donation' })).not.toBeInTheDocument()
    expect(within(c).getByText('Awaiting admin review')).toBeInTheDocument()
    expect(within(c).getByRole('link', { name: 'Add more files' })).toHaveAttribute('href', '/ngo/pickups/3/proof')
    expect(within(d).getByText('Approved')).toBeInTheDocument()
    expect(within(d).queryByRole('link', { name: /proof|files/i })).not.toBeInTheDocument()
  })

  it('does not ask for proof of donation on a pickup that is not yet collected', async () => {
    renderPage()
    const card = await screen.findByRole('article')
    expect(within(card).queryByRole('link', { name: /proof of donation/i })).not.toBeInTheDocument()
    expect(within(card).queryByText('Proof of donation')).not.toBeInTheDocument()
  })

  it('shows the notice passed back from the proof page', async () => {
    renderPage({ pathname: '/ngo/reservations', state: { notice: 'Proof of donation submitted for “Veg biryani”. An admin will review it.' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Proof of donation submitted for “Veg biryani”')
  })

  it('shows Rate provider only for completed, unrated, rateable pickups', async () => {
    api.getReservations.mockResolvedValue([
      reservation({ id: 1, title: 'A', status: 'completed', has_rated: false }),
      reservation({ id: 2, title: 'B', status: 'completed', has_rated: true }),
      reservation({ id: 3, title: 'C', status: 'completed', provider_category: 'general' }),
    ])
    renderPage()
    const cards = await screen.findAllByRole('article')
    expect(within(cards[0]).getByRole('button', { name: 'Rate provider' })).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: 'Rate provider' })).not.toBeInTheDocument()
    expect(within(cards[1]).getByText(/Rated/)).toBeInTheDocument()
    expect(within(cards[2]).queryByRole('button', { name: 'Rate provider' })).not.toBeInTheDocument()
  })

  it('rates a restaurant provider from the card', async () => {
    api.getReservations.mockResolvedValue([reservation({ status: 'completed' })])
    api.rateProvider.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rate provider' }))
    const rate = await screen.findByRole('dialog', { name: /Rate Spice Route/ })
    expect(within(rate).getByRole('button', { name: 'Submit rating' })).toBeDisabled()
    await userEvent.click(within(rate).getByRole('radio', { name: '4 stars' }))
    await userEvent.type(within(rate).getByLabelText(/Comment/), 'on time')
    await userEvent.click(within(rate).getByRole('button', { name: 'Submit rating' }))
    await waitFor(() => expect(api.rateProvider).toHaveBeenCalledWith(1, { stars: 4, comment: 'on time' }))
  })

  it('treats ALREADY_RATED as done', async () => {
    api.getReservations.mockResolvedValue([reservation({ status: 'completed' })])
    api.rateProvider.mockRejectedValue(apiError(409, 'ALREADY_RATED', 'already'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rate provider' }))
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit rating' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows empty and error states', async () => {
    api.getReservations.mockResolvedValueOnce([])
    const { unmount } = renderPage()
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
    unmount()
    api.getReservations.mockRejectedValue(apiError(500, 'ERROR', 'boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
