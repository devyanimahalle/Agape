import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import HomePage from './HomePage'

const setup = () => render(<MemoryRouter><HomePage /></MemoryRouter>)

describe('HomePage', () => {
  it('leads with AGAPE as the one h1, with the tagline badge right under it', () => {
    setup()
    const h1 = screen.getByRole('heading', { level: 1, name: 'AGAPE' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const badge = screen.getByText('Every MEAL Matters')
    expect(h1.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(h1.closest('section')).toBe(badge.closest('section'))
  })

  it('sizes the AGAPE mark moderately (capped at 8rem, not the old full-width block)', () => {
    setup()
    const h1 = screen.getByRole('heading', { level: 1, name: 'AGAPE' })
    expect(h1.className).toContain('text-[clamp(4.5rem,10vw,8rem)]')
    expect(h1.className).not.toMatch(/31vw|21rem/)
  })

  it('has dropped the surplus-food headline from the hero', () => {
    setup()
    expect(screen.queryByText('Surplus food, delivered before it goes to waste.')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /delivered before it goes to waste/i })).not.toBeInTheDocument()
  })

  it('uses the Option A copy in the hero', () => {
    setup()
    expect(screen.getByText('Verified restaurants, caterers, and home kitchens list extra meals. Verified NGOs claim and collect them within a live pickup window.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Surplus food, collected in time/)
  })

  it('keeps entry animation purely presentational (content always in the DOM)', () => {
    setup()
    expect(screen.getByText('Every MEAL Matters')).toBeVisible()
  })

  it('has exactly two hero actions, Sign in and How it works, and no Find food button', () => {
    setup()
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')
    const actions = within(hero).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])
    expect(actions).toEqual([['Sign in', '/select-role'], ['How it works', '#how']])
    expect(screen.queryByText('Find food near you')).not.toBeInTheDocument()
  })

  it('makes both hero buttons large and solid with hover states', () => {
    setup()
    for (const name of ['Sign in', 'How it works']) {
      expect(screen.getByRole('link', { name })).toHaveClass('px-6', 'sm:px-8', 'py-4', 'text-base', 'press')
    }
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveClass('bg-ink', 'text-canvas', 'hover:bg-toast')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveClass('bg-canvas', 'text-ink', 'hover:bg-panel')
  })

  it('keeps the two actions side by side on one row (no wrapping)', () => {
    setup()
    const row = screen.getByRole('link', { name: 'Sign in' }).parentElement
    expect(row).toHaveClass('flex', 'flex-nowrap')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveClass('whitespace-nowrap')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveClass('whitespace-nowrap')
  })

  it('shows the pickup-window graphic: Listed, Reserved, Collected, built from flat tokens', () => {
    setup()
    const visual = screen.getByRole('img', { name: /How a pickup works/ })
    expect(visual).toHaveClass('bg-ink', 'rounded-card')
    expect(visual.className).not.toMatch(/shadow/)
    const stages = [...visual.querySelectorAll('.pickup-stage')]
    expect(stages.map((el) => el.querySelector('.font-display + .font-display').textContent)).toEqual(['Listed', 'Reserved', 'Collected'])
    expect(stages.map((el) => el.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])
    expect(visual.querySelector('.pickup-fill')).toBeInTheDocument()
    expect(visual).toHaveTextContent('Window opens')
    expect(visual).toHaveTextContent('Window closes')
  })

  it('labels the graphic as a sample and shows no invented figures', () => {
    setup()
    const visual = screen.getByRole('img', { name: /How a pickup works/ })
    expect(visual).toHaveTextContent('Sample')
    expect(visual.textContent).not.toMatch(/\d{2,}\s*(meals|kg)/i)
  })

  it('How it works points at a section that exists', () => {
    setup()
    expect(document.getElementById('how')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
  })

  it('keeps the How it works steps as typographic cards: a title and a description, no icons', () => {
    setup()
    const steps = [...document.getElementById('how').querySelectorAll('ol > li')]
    expect(steps).toHaveLength(3)
    for (const li of steps) {
      expect(li.querySelector('svg')).toBeNull()
      expect(li.querySelector('img')).toBeNull()
      expect(li.querySelector('.icon-tile')).toBeNull()
      const card = li.firstElementChild
      expect(card.children).toHaveLength(2) // h3 + p
      expect(card.firstElementChild.tagName).toBe('H3')
    }
    expect(within(steps[0]).getByRole('heading', { name: 'Donors list surplus food' })).toBeInTheDocument()
    expect(within(steps[1]).getByRole('heading', { name: 'Verified NGOs reserve' })).toBeInTheDocument()
    expect(within(steps[2]).getByRole('heading', { name: 'Pickup is confirmed' })).toBeInTheDocument()
  })

  it('carries no icon graphics or images on the landing page', () => {
    setup()
    expect(document.querySelectorAll('svg')).toHaveLength(0)
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('states the honest-claims copy', () => {
    setup()
    expect(screen.getByText('Admin-verified NGOs')).toBeInTheDocument()
    expect(screen.getByText(/format check plus admin review/)).toBeInTheDocument()
    expect(screen.getByText(/not an official FSSAI verification/i)).toBeInTheDocument()
    expect(screen.getByText('Documents stored privately')).toBeInTheDocument()
    expect(screen.getByText(/estimates/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/FSSAI[- ]verified|FSSAI[- ]certified/i)
  })

  it('previews NGO, Donor and Admin as typographic cards with no icons', () => {
    setup()
    const section = document.getElementById('roles').closest('section')
    const cards = within(section).getAllByRole('article')
    expect(cards).toHaveLength(3)
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['NGO', 'Donor', 'Admin'])
    for (const card of cards) expect(card.querySelector('svg')).toBeNull()
    expect(screen.queryByText('In development')).not.toBeInTheDocument()
  })

  it('has no Open ... buttons or links in the Who it is for cards', () => {
    setup()
    const section = document.getElementById('roles').closest('section')
    expect(within(section).queryAllByRole('link')).toHaveLength(0)
    expect(within(section).queryAllByRole('button')).toHaveLength(0)
    for (const label of ['Open food board', 'Open donor area', 'Open admin']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('keeps the role cards balanced: same structure, hover lift, no extra controls', () => {
    setup()
    const section = document.getElementById('roles').closest('section')
    for (const card of within(section).getAllByRole('article')) {
      expect(card).toHaveClass('card-lift')
      expect(card.children).toHaveLength(2) // name, description
    }
  })
})
