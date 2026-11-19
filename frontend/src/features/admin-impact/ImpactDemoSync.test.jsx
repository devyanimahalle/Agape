import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Demo mode with the real mock stores: what an NGO, donor or admin does in a session is what Impact shows.
vi.mock('../../lib/api', async (orig) => ({ ...(await orig()), USE_MOCKS: true }))
const h = vi.hoisted(() => ({ user: null }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }))

let ImpactPage
let ngo
let adminApi
let adminLib

beforeEach(async () => {
  vi.resetModules()
  h.user = null
  ;({ ImpactPage } = await import('./index'))
  ngo = await import('../ngo-reservations/mockApi')
  adminApi = await import('./api')
  adminLib = await import('../../lib/mockAdmin')
})

const card = (title) => screen.getByText(title).closest('article')
const num = (title) => within(card(title)).getByText(/^[\d,.]+( kg)?$/).textContent

describe('Impact page in demo mode follows the session', () => {
  it('opens on the seeded history (175 estimated meals from 5 collected pickups)', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    expect([num('Meals redistributed (est.)'), num('Pickups collected'), num('Verified donors'), num('Verified NGOs')]).toEqual(['175', '5', '2', '1'])
    expect(num('Meals with approved proof (est.)')).toBe('25')
  })

  it('a pickup confirmed as the NGO shows up when Impact is opened next', async () => {
    const before = render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    before.unmount()

    await ngo.reserve(1)
    await ngo.completePickup(1) // Veg biryani: 50 estimated meals
    render(<ImpactPage />)
    await waitFor(() => expect(num('Meals redistributed (est.)')).toBe('225'))
    expect(num('Pickups collected')).toBe('6')
    expect(within(screen.getByLabelText('Recent collected pickups')).getByText('Veg biryani')).toBeInTheDocument()
    expect(within(screen.getByLabelText('All listings by status')).getByText('Total 12')).toBeInTheDocument()
  })

  it('an admin approving the proof of donation raises the confirmed meals', async () => {
    await ngo.reserve(3)
    await ngo.completePickup(3)
    await ngo.submitProof(3, [new File(['x'], 'a.png')], 'fed 20')
    const proof = (await adminApi.fetchProofs('pending')).find((p) => p.listing_id === 3)
    await adminApi.reviewProof(proof.id, { decision: 'approved', stars: 5 })
    render(<ImpactPage />)
    await waitFor(() => expect(num('Meals with approved proof (est.)')).toBe('45'))
  })

  it('Reset demo accounts takes the public figures to zero and the empty states appear', async () => {
    adminLib.resetMockAccounts()
    render(<ImpactPage />)
    await waitFor(() => expect(num('Meals redistributed (est.)')).toBe('0'))
    expect([num('Pickups collected'), num('Verified donors'), num('Verified NGOs')]).toEqual(['0', '0', '0'])
    expect(screen.getByText('No pickups have been collected yet.')).toBeInTheDocument()
    expect(screen.getByText('No monthly data available.')).toBeInTheDocument()
  })

  it('a signed-in NGO sees its own history, matching its reservations, and the names stay private when signed out', async () => {
    h.user = { id: 'mock-ngo', role: 'ngo' }
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    const reservations = await ngo.getReservations()
    const tile = (label) => within(section).getByText(label).closest('div').querySelector('dd').textContent
    expect(tile('Pickups collected')).toBe(String(reservations.filter((r) => r.status === 'completed').length))
    expect(within(section).getByText(/from Neighbour Home Kitchen · collected by Asha Foundation/)).toBeInTheDocument()
    expect(within(section).getByText('No proof of donation yet')).toBeInTheDocument()
  })

  it('a signed-in donor sees only their own collected pickup', async () => {
    h.user = { id: 'mock-provider', role: 'provider' }
    render(<ImpactPage />)
    const section = await screen.findByLabelText('Your impact')
    expect(within(section).getByText('Poha, 30 portions')).toBeInTheDocument()
    expect(within(section).queryByText('Roti and sabzi')).not.toBeInTheDocument()
    expect(within(section).getByText('Meals donated (est.)').closest('div').querySelector('dd').textContent).toBe('30')
  })

  it('stays user-event friendly: focusing the window re-reads the stores', async () => {
    render(<ImpactPage />)
    await screen.findByText('Meals redistributed (est.)')
    await ngo.reserve(4)
    await ngo.completePickup(4) // Dal and rice: 38 estimated meals
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(num('Meals redistributed (est.)')).toBe('213'))
    await userEvent.tab()
  })
})
