import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RoleSelectPage from './RoleSelectPage'

const setup = (path = '/select-role') => render(<MemoryRouter initialEntries={[path]}><RoleSelectPage /></MemoryRouter>)

describe('RoleSelectPage', () => {
  it('has an orange-band title, the short subtitle and three role cards', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText('Choose how you use Agape.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/its own sign-in and its own home/)
    for (const name of ['NGO', 'Donor / Provider', 'Admin']) {
      expect(screen.getByRole('article', { name })).toBeInTheDocument()
    }
  })

  it('each card has a description and a button into that role\'s sign-in', () => {
    setup()
    const hrefs = {
      NGO: ['Sign in as NGO', '/login?role=ngo'],
      'Donor / Provider': ['Sign in as Donor / Provider', '/login?role=provider'],
      Admin: ['Sign in as Admin', '/login?role=admin'],
    }
    for (const [card, [label, href]] of Object.entries(hrefs)) {
      const el = screen.getByRole('article', { name: card })
      expect(within(el).getByRole('link', { name: label })).toHaveAttribute('href', href)
      expect(within(el).getAllByText(/\w{4,}/).length).toBeGreaterThan(1)
    }
  })

  it('offers registration for NGOs and donors but never for admins', () => {
    setup()
    expect(within(screen.getByRole('article', { name: 'NGO' })).getByRole('link', { name: 'Register your NGO' })).toHaveAttribute('href', '/register?role=ngo')
    expect(within(screen.getByRole('article', { name: 'Donor / Provider' })).getByRole('link', { name: 'Register as a donor' })).toHaveAttribute('href', '/register?role=provider')
    expect(within(screen.getByRole('article', { name: 'Admin' })).queryByRole('link', { name: /register/i })).not.toBeInTheDocument()
  })

  it('carries a safe ?next= through to the portals, and drops an unsafe one', () => {
    setup('/select-role?next=%2Fngo%2Freservations')
    expect(screen.getByRole('link', { name: 'Sign in as NGO' })).toHaveAttribute('href', '/login?role=ngo&next=%2Fngo%2Freservations')
  })

  it('ignores an open-redirect ?next=', () => {
    setup('/select-role?next=%2F%2Fevil.example.com')
    expect(screen.getByRole('link', { name: 'Sign in as NGO' })).toHaveAttribute('href', '/login?role=ngo')
  })

  it('links back to the home page', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/')
  })
})

describe('RoleSelectPage compact layout', () => {
  it('uses the compact band (no tall minimum height) and keeps every CTA on one line', () => {
    setup()
    expect(screen.getByRole('banner')).not.toHaveClass('md:min-h-[21rem]')
    for (const link of screen.getAllByRole('link', { name: /^Sign in as/ })) {
      expect(link).toHaveClass('whitespace-nowrap')
    }
  })
})
