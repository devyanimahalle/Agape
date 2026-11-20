import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import NgoReservationsPage from '../NgoReservationsPage'
import { apiError, reservation } from './fixtures'

vi.mock('../api')

const png = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], 'proof.png', { type: 'image/png' })

beforeEach(() => {
  vi.resetAllMocks()
  api.getReservations.mockResolvedValue([reservation({ id: 1, title: 'Veg biryani' })])
})

describe('NgoReservationsPage', () => {
  it('lists reservations with To collect actions', async () => {
    render(<NgoReservationsPage />)
    const card = await screen.findByRole('article')
    expect(within(card).getByRole('button', { name: 'Complete pickup' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Cancel reservation' })).toBeInTheDocument()
  })

  it('filters by status tab', async () => {
    render(<NgoReservationsPage />)
    await screen.findByRole('article')
    await userEvent.click(screen.getByRole('tab', { name: 'Completed' }))
    await waitFor(() => expect(api.getReservations).toHaveBeenLastCalledWith('completed'))
  })

  it('cancels only after confirmation', async () => {
    api.cancelReservation.mockResolvedValue({})
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel reservation' }))
    expect(api.cancelReservation).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel reservation' }))
    await waitFor(() => expect(api.cancelReservation).toHaveBeenCalledWith(1))
    expect(await screen.findByRole('status')).toHaveTextContent(/Cancelled/)
  })

  it('blocks completing without a proof file', async () => {
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Complete pickup' }))
    expect(screen.getByRole('button', { name: 'Confirm pickup' })).toBeDisabled()
    expect(api.completePickup).not.toHaveBeenCalled()
  })

  it('rejects a disallowed file type client-side', async () => {
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Complete pickup' }))
    const bad = new File(['x'], 'run.exe', { type: 'application/x-msdownload' })
    await userEvent.upload(screen.getByLabelText('Proof files'), bad, { applyAccept: false })
    await userEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/only PDF, JPG or PNG/)
    expect(api.completePickup).not.toHaveBeenCalled()
  })

  it('completes with proof and note, then offers to rate a restaurant provider', async () => {
    api.completePickup.mockResolvedValue({})
    api.rateProvider.mockResolvedValue({})
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Complete pickup' }))
    const file = png()
    await userEvent.upload(screen.getByLabelText('Proof files'), file)
    await userEvent.type(screen.getByLabelText(/Note/), 'collected all')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))
    await waitFor(() => expect(api.completePickup).toHaveBeenCalledWith(1, [file], 'collected all'))

    const rate = await screen.findByRole('dialog', { name: /Rate Spice Route/ })
    expect(within(rate).getByRole('button', { name: 'Submit rating' })).toBeDisabled()
    await userEvent.click(within(rate).getByRole('radio', { name: '4 stars' }))
    await userEvent.type(within(rate).getByLabelText(/Comment/), 'on time')
    await userEvent.click(within(rate).getByRole('button', { name: 'Submit rating' }))
    await waitFor(() => expect(api.rateProvider).toHaveBeenCalledWith(1, { stars: 4, comment: 'on time' }))
  })

  it('does not offer rating for general providers', async () => {
    api.getReservations.mockResolvedValue([reservation({ provider_category: 'general' })])
    api.completePickup.mockResolvedValue({})
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Complete pickup' }))
    await userEvent.upload(screen.getByLabelText('Proof files'), png())
    await userEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))
    await waitFor(() => expect(api.completePickup).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows server errors inside the complete dialog and keeps it open', async () => {
    api.completePickup.mockRejectedValue(apiError(400, 'INVALID_FILE_TYPE', 'Only PDF, JPG or PNG files are allowed'))
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Complete pickup' }))
    await userEvent.upload(screen.getByLabelText('Proof files'), png())
    await userEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only PDF/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows Rate provider only for completed, unrated, rateable pickups', async () => {
    api.getReservations.mockResolvedValue([
      reservation({ id: 1, title: 'A', status: 'completed', has_rated: false }),
      reservation({ id: 2, title: 'B', status: 'completed', has_rated: true }),
      reservation({ id: 3, title: 'C', status: 'completed', provider_category: 'general' }),
    ])
    render(<NgoReservationsPage />)
    const cards = await screen.findAllByRole('article')
    expect(within(cards[0]).getByRole('button', { name: 'Rate provider' })).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: 'Rate provider' })).not.toBeInTheDocument()
    expect(within(cards[1]).getByText(/Rated/)).toBeInTheDocument()
    expect(within(cards[2]).queryByRole('button', { name: 'Rate provider' })).not.toBeInTheDocument()
  })

  it('treats ALREADY_RATED as done', async () => {
    api.getReservations.mockResolvedValue([reservation({ status: 'completed' })])
    api.rateProvider.mockRejectedValue(apiError(409, 'ALREADY_RATED', 'already'))
    render(<NgoReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Rate provider' }))
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit rating' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows empty and error states', async () => {
    api.getReservations.mockResolvedValueOnce([])
    const { unmount } = render(<NgoReservationsPage />)
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
    unmount()
    api.getReservations.mockRejectedValue(apiError(500, 'ERROR', 'boom'))
    render(<NgoReservationsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
