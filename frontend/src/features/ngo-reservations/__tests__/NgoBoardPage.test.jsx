import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import NgoBoardPage from '../NgoBoardPage'
import { ME, apiError, boardItem } from './fixtures'

vi.mock('../api')
vi.mock('../components/BoardMap', () => ({
  default: ({ listings }) => <div data-testid="board-map">{listings.length} markers</div>,
}))
vi.mock('../components/PinMap', () => ({
  default: ({ lat, lng, onMove }) => (
    <button type="button" data-testid="pin" onClick={() => onMove(lat + 1, lng + 1)}>pin {lat},{lng}</button>
  ),
}))

const items = [
  boardItem({ id: 1, title: 'Nearest food', distance_km: 1.2 }),
  boardItem({ id: 2, title: 'Farther food', distance_km: 9.8, rating_avg: null, provider_category: 'general' }),
]

beforeEach(() => {
  vi.resetAllMocks()
  api.getMe.mockResolvedValue(ME)
  api.getBoard.mockResolvedValue(items)
})

describe('NgoBoardPage', () => {
  it('loads from the saved location and shows cards in the order the API returns (nearest first)', async () => {
    render(<NgoBoardPage />)
    const cards = await screen.findAllByRole('article')
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Nearest food', 'Farther food'])
    expect(api.getBoard).toHaveBeenCalledWith(28.6315, 77.2167)
    expect(screen.getByText(/Connaught Place/)).toBeInTheDocument()
  })

  it('toggles between list and map views', async () => {
    render(<NgoBoardPage />)
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'map' }))
    expect(screen.getByTestId('board-map')).toHaveTextContent('2 markers')
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'list' }))
    expect(await screen.findAllByRole('article')).toHaveLength(2)
  })

  it('reserves after confirmation and removes the card', async () => {
    api.reserve.mockResolvedValue({})
    render(<NgoBoardPage />)
    const card = (await screen.findAllByRole('article'))[0]
    await userEvent.click(within(card).getByRole('button', { name: 'Reserve' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/whole listing/i)
    expect(api.reserve).not.toHaveBeenCalled() // nothing happens before confirming
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reserve' }))
    await waitFor(() => expect(api.reserve).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Nearest food', { selector: 'h3' })).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(/Reserved/)
  })

  it('does not reserve when the dialog is dismissed', async () => {
    render(<NgoBoardPage />)
    await userEvent.click(within((await screen.findAllByRole('article'))[0]).getByRole('button', { name: 'Reserve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(api.reserve).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains a 409 (taken by another NGO) and refreshes the board', async () => {
    api.reserve.mockRejectedValue(apiError(409, 'ALREADY_RESERVED', 'no longer available'))
    render(<NgoBoardPage />)
    await userEvent.click(within((await screen.findAllByRole('article'))[0]).getByRole('button', { name: 'Reserve' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reserve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/just taken/i)
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledTimes(2))
  })

  it('shows the not-approved message for unverified NGOs', async () => {
    api.getBoard.mockRejectedValue(apiError(403, 'NOT_VERIFIED', 'not approved'))
    render(<NgoBoardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/not been approved/i)
  })

  it('shows an empty state and an error state with retry', async () => {
    api.getBoard.mockResolvedValueOnce([])
    const { unmount } = render(<NgoBoardPage />)
    expect(await screen.findByText(/No food is listed/i)).toBeInTheDocument()
    unmount()
    api.getBoard.mockReset()
    api.getBoard.mockRejectedValueOnce(apiError(0, 'NETWORK', 'Could not reach the server')).mockResolvedValue(items)
    render(<NgoBoardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach/)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findAllByRole('article')).toHaveLength(2)
  })

  it('geocodes only when Search is pressed, then re-sorts from the chosen location', async () => {
    api.geocode.mockResolvedValue([{ label: 'Saket, Delhi', lat: 28.52, lng: 77.2 }])
    render(<NgoBoardPage />)
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'Change location' }))
    await userEvent.type(screen.getByLabelText('Search address'), 'Saket')
    expect(api.geocode).not.toHaveBeenCalled() // no search per keystroke
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(api.geocode).toHaveBeenCalledWith('Saket'))
    await userEvent.click(await screen.findByRole('button', { name: 'Saket, Delhi' }))
    await userEvent.click(screen.getByRole('button', { name: 'Use this location' }))
    await waitFor(() => expect(api.getBoard).toHaveBeenLastCalledWith(28.52, 77.2))
    expect(screen.getByText('Saket, Delhi')).toBeInTheDocument()
  })

  it('lets the NGO drag the pin and then go back to the saved location', async () => {
    render(<NgoBoardPage />)
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'Change location' }))
    await userEvent.click(screen.getByTestId('pin'))
    await userEvent.click(screen.getByRole('button', { name: 'Use this location' }))
    await waitFor(() => expect(api.getBoard).toHaveBeenLastCalledWith(29.6315, 78.2167))
    await userEvent.click(screen.getByRole('button', { name: 'Change location' }))
    await userEvent.click(screen.getByRole('button', { name: 'Use saved location' }))
    await waitFor(() => expect(api.getBoard).toHaveBeenLastCalledWith(28.6315, 77.2167))
  })

  it('rejects very short searches without calling the API', async () => {
    render(<NgoBoardPage />)
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'Change location' }))
    await userEvent.type(screen.getByLabelText('Search address'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 3/i)
    expect(api.geocode).not.toHaveBeenCalled()
  })

  it('asks for a location when the NGO has none saved', async () => {
    api.getMe.mockResolvedValue({ ...ME, profile: { lat: null, lng: null } })
    render(<NgoBoardPage />)
    expect(await screen.findByText(/Set your location above/)).toBeInTheDocument()
    expect(api.getBoard).not.toHaveBeenCalled()
  })
})
