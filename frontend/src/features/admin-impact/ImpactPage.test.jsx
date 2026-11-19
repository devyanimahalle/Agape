import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api')
const h = vi.hoisted(() => ({ user: null }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }))

import * as api from './api'
import ImpactPage from './ImpactPage'

const impact = (o = {}) => ({
  meals_redistributed: 175, kg_saved: 70, listings_completed: 5, active_ngos: 3, active_providers: 4,
  by_month: [{ month: '2026-03', meals: 175, kg: 70 }], listings_confirmed: 1, meals_confirmed: 25,
  verified_donors: 2, verified_ngos: 1,
  by_status: { listed: 5, reserved: 0, completed: 5, cancelled: 1, expired: 1 },
  by_category: [{ category: 'restaurant', listings: 3, meals: 130, kg: 52 }, { category: 'general', listings: 1, meals: 20, kg: 8 }],
  recent: [
    { id: 1, title: 'Roti and sabzi', food_type: 'cooked', quantity: 8, unit: 'kg', est_meals: 20, est_kg: 8, completed_at: '2026-03-02T10:00:00Z', donor_category: 'general', proof_status: 'none', donor: null, ngo: null },
    { id: 2, title: 'Poha', food_type: 'cooked', quantity: 30, unit: 'portions', est_meals: 30, est_kg: 12, completed_at: '2026-03-01T10:00:00Z', donor_category: 'restaurant', proof_status: 'approved', donor: null, ngo: null },
  ],
  ...o,
})
const card = (title) => screen.getByText(title).closest('article')
const num = (title) => within(card(title)).getByText(/^[\d,.]+( kg)?$/).textContent

beforeEach(() => {
  vi.resetAllMocks()
  h.user = null
  api.fetchImpact.mockResolvedValue(impact())
  api.fetchMyImpact.mockResolvedValue(null)
})

describe('ImpactPage figures (signed out)', () => {
  it('shows every figure the API reports, labelled as estimates where they are', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    expect(num('Meals redistributed (est.)')).toBe('175')
    expect(num('Kilograms saved (est.)')).toBe('70 kg')
    expect(num('Pickups collected')).toBe('5')
    expect(num('Meals with approved proof (est.)')).toBe('25')
    expect(within(card('Meals with approved proof (est.)')).getByText(/1 of 5 pickups have an admin-approved proof of donation/)).toBeInTheDocument()
    expect(num('Verified donors')).toBe('2')
    expect(within(card('Verified donors')).getByText('4 have had food collected')).toBeInTheDocument()
    expect(num('Verified NGOs')).toBe('1')
    expect(screen.getByText(/All meal and kilogram figures are estimates/)).toBeInTheDocument()
  })

  it('shows the listing status breakdown, the donor-type split and the recent collected pickups from the data', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    const statuses = screen.getByLabelText('All listings by status')
    expect(within(statuses).getByText('Total 12')).toBeInTheDocument()
    const cats = screen.getByLabelText('Collected food by donor type')
    expect(within(cats).getByText('Restaurants')).toBeInTheDocument()
    expect(within(cats).getByText('Home kitchens and others')).toBeInTheDocument()
    expect(within(cats).getByText(/3 pickups · ≈ 130 meals \(estimate\)/)).toBeInTheDocument()
    const recent = screen.getByLabelText('Recent collected pickups')
    expect(within(recent).getByText('Roti and sabzi')).toBeInTheDocument()
    expect(within(recent).getByText(/≈ 20 meals/)).toBeInTheDocument()
    expect(within(recent).getByText('No proof of donation yet')).toBeInTheDocument()
    expect(within(recent).getByText('Proof of donation approved')).toBeInTheDocument()
  })

  it('names nobody publicly and says so; there is no personal section', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    expect(screen.getByText('Organisation names are shown to signed-in users only.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Your impact')).not.toBeInTheDocument()
    expect(api.fetchMyImpact).not.toHaveBeenCalled()
    const recent = screen.getByLabelText('Recent collected pickups')
    expect(within(recent).getByText(/Home kitchen/)).toBeInTheDocument() // donor type instead of a name
  })

  it('shows honest empty states when nothing has been collected', async () => {
    api.fetchImpact.mockResolvedValue(impact({
      meals_redistributed: 0, kg_saved: 0, listings_completed: 0, active_ngos: 0, active_providers: 0, by_month: [],
      listings_confirmed: 0, meals_confirmed: 0, verified_donors: 0, verified_ngos: 0,
      by_status: { listed: 0, reserved: 0, completed: 0, cancelled: 0, expired: 0 }, by_category: [], recent: [],
    }))
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    expect(num('Meals redistributed (est.)')).toBe('0')
    expect(screen.getByText('No pickups have been collected yet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing has been collected yet.')).toBeInTheDocument()
    expect(screen.getByText('No monthly data available.')).toBeInTheDocument()
  })

  it('shows an error when the figures cannot be loaded', async () => {
    api.fetchImpact.mockRejectedValue(new Error('offline'))
    render(<ImpactPage />)
    expect(await screen.findByText('Failed to load impact data')).toBeInTheDocument()
  })
})

describe('ImpactPage personal history (signed in)', () => {
  const mine = (role, summary, recent = []) => ({ role, summary, recent })

  it('a donor sees their own figures and named pickups', async () => {
    h.user = { id: 5, role: 'provider' }
    api.fetchMyImpact.mockResolvedValue(mine('provider', {
      listings_total: 3, listings_open: 1, listings_reserved: 0, pickups_completed: 2, meals_donated: 80, kg_donated: 32, proofs_approved: 1, proofs_awaiting: 1,
    }, [{ id: 9, title: 'Collected rice', food_type: 'cooked', quantity: 10, unit: 'kg', est_meals: 25, est_kg: 10, completed_at: '2026-03-03T10:00:00Z', donor_category: 'restaurant', proof_status: 'pending', donor: 'Demo Kitchen', ngo: 'Asha Foundation' }]))
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    expect(api.fetchMyImpact).toHaveBeenCalledWith('provider')
    expect(within(section).getByRole('heading', { name: 'Your impact as a donor' })).toBeInTheDocument()
    const tile = (label) => within(section).getByText(label).closest('div').querySelector('dd').textContent
    expect(tile('Listings posted')).toBe('3')
    expect(tile('Meals donated (est.)')).toBe('80')
    expect(tile('Kilograms donated (est.)')).toBe('32')
    expect(tile('Proofs awaiting review')).toBe('1')
    expect(within(section).getByText(/from Demo Kitchen · collected by Asha Foundation/)).toBeInTheDocument()
    expect(within(section).getByText('Proof of donation awaiting review')).toBeInTheDocument()
    expect(screen.queryByText('Organisation names are shown to signed-in users only.')).not.toBeInTheDocument()
  })

  it('an NGO sees collected meals and the proofs it still owes', async () => {
    h.user = { id: 10, role: 'ngo' }
    api.fetchMyImpact.mockResolvedValue(mine('ngo', {
      reservations_open: 1, pickups_completed: 2, meals_collected: 70, kg_collected: 28, proofs_needed: 1, proofs_awaiting: 1, proofs_approved: 0,
    }))
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    expect(within(section).getByRole('heading', { name: 'Your impact as an NGO' })).toBeInTheDocument()
    const tile = (label) => within(section).getByText(label).closest('div').querySelector('dd').textContent
    expect(tile('Meals collected (est.)')).toBe('70')
    expect(tile('Proof of donation needed')).toBe('1')
    expect(within(section).getByText(/You have no collected pickups yet/)).toBeInTheDocument()
  })

  it('an admin sees the platform summary', async () => {
    h.user = { id: 1, role: 'admin' }
    api.fetchMyImpact.mockResolvedValue(mine('admin', { users_total: 9, verified_donors: 2, verified_ngos: 1, verifications_open: 3, proofs_awaiting_review: 2, pickups_completed: 5 }))
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    expect(within(section).getByRole('heading', { name: 'The platform at a glance' })).toBeInTheDocument()
    expect(within(section).getByText('Open verification requests').closest('div').querySelector('dd').textContent).toBe('3')
  })

  it('ignores a personal summary that belongs to a different role than the signed-in one', async () => {
    h.user = { id: 5, role: 'ngo' }
    api.fetchMyImpact.mockResolvedValue(mine('provider', { listings_total: 1 }))
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    expect(screen.queryByLabelText('Your impact')).not.toBeInTheDocument()
  })
})

describe('ImpactPage stays current', () => {
  it('re-reads the public figures when the tab regains focus, without a loading flash', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    api.fetchImpact.mockResolvedValue(impact({ meals_redistributed: 225, listings_completed: 6 }))
    await act(async () => { fireEvent.focus(window) })
    await waitFor(() => expect(num('Meals redistributed (est.)')).toBe('225'))
    expect(screen.queryByText('Loading impact data…')).not.toBeInTheDocument()
    expect(num('Pickups collected')).toBe('6')
  })

  it('also re-reads the signed-in summary on focus', async () => {
    h.user = { id: 10, role: 'ngo' }
    api.fetchMyImpact.mockResolvedValue({ role: 'ngo', summary: { pickups_completed: 1, reservations_open: 0, meals_collected: 20, kg_collected: 8, proofs_needed: 1, proofs_awaiting: 0, proofs_approved: 0 }, recent: [] })
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    api.fetchMyImpact.mockResolvedValue({ role: 'ngo', summary: { pickups_completed: 2, reservations_open: 0, meals_collected: 70, kg_collected: 28, proofs_needed: 2, proofs_awaiting: 0, proofs_approved: 0 }, recent: [] })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(within(section).getByText('Meals collected (est.)').closest('div').querySelector('dd').textContent).toBe('70'))
  })

  it('keeps the last numbers on screen if a refresh fails', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    api.fetchImpact.mockRejectedValue(new Error('offline'))
    await act(async () => { fireEvent.focus(window) })
    expect(num('Meals redistributed (est.)')).toBe('175')
    expect(screen.queryByText('Failed to load impact data')).not.toBeInTheDocument()
  })

  it('reads fresh data every time the page opens (navigating from another screen)', async () => {
    const first = render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    first.unmount()
    api.fetchImpact.mockResolvedValue(impact({ meals_redistributed: 0, listings_completed: 0 }))
    render(<ImpactPage />)
    await waitFor(() => expect(num('Meals redistributed (est.)')).toBe('0'))
    expect(api.fetchImpact).toHaveBeenCalledTimes(2)
  })
})
