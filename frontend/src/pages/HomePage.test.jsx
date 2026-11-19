import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import HomePage from './HomePage'

const setup = () => render(<MemoryRouter><HomePage /></MemoryRouter>)

describe('HomePage', () => {
  it('leads with the AGAPE title and the tagline', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'AGAPE' })).toBeInTheDocument()
    expect(screen.getByText('Every MEAL Matters')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/select-role')
  })

  it('keeps entry animation purely presentational (content always in the DOM)', () => {
    setup()
    expect(screen.getByText('Every MEAL Matters')).toBeVisible()
  })

  it('has exactly two hero actions, Sign in and How it works, and no Find food button', () => {
    setup()
    const hero = screen.getByRole('heading', { level: 1, name: 'AGAPE' }).closest('section')
    const actions = within(hero).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])
    expect(actions).toEqual([['Sign in', '/select-role'], ['How it works', '#how']])
    expect(screen.queryByText('Find food near you')).not.toBeInTheDocument()
  })

  it('makes both hero buttons large and solid with hover states', () => {
    setup()
    for (const name of ['Sign in', 'How it works']) {
      expect(screen.getByRole('link', { name })).toHaveClass('px-8', 'py-4', 'text-base', 'press')
    }
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveClass('bg-ink', 'text-canvas', 'hover:bg-toast')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveClass('bg-canvas', 'text-ink', 'hover:bg-panel')
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
