import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api')
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }))

import * as api from '../api'
import { useAuth } from '../../../context/AuthContext'
import ProviderListingsPage from '../ProviderListingsPage'

const renderPage = () => render(<MemoryRouter><ProviderListingsPage /></MemoryRouter>)
const as = (over) => useAuth.mockReturnValue({
  mock: false,
  profile: { category: 'restaurant', address: 'Khan Market', lat: 28.6, lng: 77.2 },
  verificationStatus: 'approved',
  ...over,
})

const row = (over = {}) => ({
  id: 1, title: 'Dal and rice', food_type: 'cooked meal', quantity: 40, unit: 'portions', est_meals: 40, est_kg: 16,
  window_start: '2030-01-01T10:00:00Z', window_end: '2030-01-01T14:00:00Z', address: 'India Gate', lat: 28.6, lng: 77.2, status: 'listed', ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  api.fetchMyListings.mockResolvedValue([row()])
})

describe('gating', () => {
  it('shows a verification gate and never loads or posts for an unverified restaurant', () => {
    as({ verificationStatus: 'pending' })
    renderPage()
    expect(screen.getByText('Get verified before you list food')).toBeInTheDocument()
    expect(screen.getByText(/documents are with an admin/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to verification' })).toHaveAttribute('href', '/provider')
    expect(screen.queryByLabelText(/What is it/)).not.toBeInTheDocument()
    expect(api.fetchMyListings).not.toHaveBeenCalled()
  })

  it('lets general (home kitchen) donors in without verification', async () => {
    as({ profile: { category: 'general' }, verificationStatus: 'pending' })
    renderPage()
    expect(await screen.findByLabelText(/What is it/)).toBeInTheDocument()
  })

  it('lets the demo donor in', async () => {
    as({ mock: true, profile: null, verificationStatus: null })
    renderPage()
    expect(await screen.findByLabelText(/What is it/)).toBeInTheDocument()
  })
})

describe('verified donor', () => {
  it('lists existing listings with an estimate label', async () => {
    as()
    renderPage()
    expect(await screen.findByText('Dal and rice')).toBeInTheDocument()
    expect(screen.getByText(/about 40 \(estimate\)/)).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('prefills the pickup address and coordinates from the profile', async () => {
    as()
    renderPage()
    expect(await screen.findByLabelText(/Pickup address/)).toHaveValue('Khan Market')
    expect(screen.getByLabelText(/Latitude/)).toHaveValue('28.6')
  })

  it('blocks submission and explains what is missing', async () => {
    as({ profile: { category: 'restaurant' } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'List this food' }))
    expect(screen.getByText(/Say what the food is/)).toBeInTheDocument()
    expect(screen.getByText(/quantity greater than 0/)).toBeInTheDocument()
    expect(screen.getByText(/Latitude must be between/)).toBeInTheDocument()
    expect(api.createListing).not.toHaveBeenCalled()
  })

  it('rejects out-of-range coordinates', async () => {
    as()
    renderPage()
    await userEvent.type(await screen.findByLabelText(/What is it/), 'Rice')
    await userEvent.type(screen.getByLabelText(/Food type/), 'cooked meal')
    await userEvent.type(screen.getByLabelText(/Quantity/), '10')
    const lat = screen.getByLabelText(/Latitude/)
    await userEvent.clear(lat)
    await userEvent.type(lat, '120')
    await userEvent.click(screen.getByRole('button', { name: 'List this food' }))
    expect(screen.getByText(/Latitude must be between/)).toBeInTheDocument()
    expect(api.createListing).not.toHaveBeenCalled()
  })

  it('creates a listing and shows it with an estimate notice', async () => {
    as()
    api.createListing.mockResolvedValue(row({ id: 2, title: 'Fresh bread', est_meals: 30, quantity: 12, unit: 'kg' }))
    renderPage()
    await userEvent.type(await screen.findByLabelText(/What is it/), 'Fresh bread')
    await userEvent.type(screen.getByLabelText(/Food type/), 'bakery')
    await userEvent.type(screen.getByLabelText(/Quantity/), '12')
    await userEvent.selectOptions(screen.getByLabelText(/Unit/), 'kg')
    await userEvent.click(screen.getByRole('button', { name: 'List this food' }))
    await waitFor(() => expect(api.createListing).toHaveBeenCalledTimes(1))
    const body = api.createListing.mock.calls[0][0]
    expect(body).toMatchObject({ title: 'Fresh bread', food_type: 'bakery', quantity: 12, unit: 'kg', address: 'Khan Market', lat: 28.6, lng: 77.2, notes: null })
    expect(new Date(body.window_end) > new Date(body.window_start)).toBe(true)
    expect(body.window_start).toMatch(/Z$/)
    expect(await screen.findByRole('status')).toHaveTextContent(/about 30 meals \(an estimate\)/)
    expect(within(screen.getByLabelText('Your listings')).getByText('Fresh bread')).toBeInTheDocument()
  })

  it('shows the server message when the create call fails', async () => {
    as()
    api.createListing.mockRejectedValue(Object.assign(new Error('x'), { detail: 'Your account is not verified yet' }))
    renderPage()
    await userEvent.type(await screen.findByLabelText(/What is it/), 'Rice')
    await userEvent.type(screen.getByLabelText(/Food type/), 'cooked meal')
    await userEvent.type(screen.getByLabelText(/Quantity/), '5')
    await userEvent.click(screen.getByRole('button', { name: 'List this food' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your account is not verified yet')
  })
})
