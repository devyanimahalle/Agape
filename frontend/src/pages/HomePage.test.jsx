import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import HomePage from './HomePage'

const setup = () => render(<MemoryRouter><HomePage /></MemoryRouter>)

describe('HomePage', () => {
  it('leads with the headline and the tagline badge', () => {
    setup()
    const h1 = screen.getByRole('heading', { level: 1, name: 'Surplus food, delivered before it goes to waste.' })
    expect(h1).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Every MEAL Matters')).toBeInTheDocument()
    // the badge sits above the headline in the same column
    expect(screen.getByText('Every MEAL Matters').compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('no longer shows the giant AGAPE wordmark in the hero (it is in the navbar)', () => {
    setup()
    expect(screen.queryByRole('heading', { name: 'AGAPE' })).not.toBeInTheDocument()
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')
    expect(within(hero).queryByText('AGAPE')).not.toBeInTheDocument()
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

  it('still links the NGO role card to the food board', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Open food board' })).toHaveAttribute('href', '/ngo')
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

  it('previews all three roles and links each one to its area', () => {
    setup()
    for (const name of ['NGO', 'Donor', 'Admin']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText('In development')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open donor area' })).toHaveAttribute('href', '/provider')
    expect(screen.getByRole('link', { name: 'Open admin' })).toHaveAttribute('href', '/admin')
  })
})
