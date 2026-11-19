import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import HomePage from './HomePage'

const setup = () => render(<MemoryRouter><HomePage /></MemoryRouter>)

describe('HomePage', () => {
  it('links the main CTAs to /ngo', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Find food near you' })).toHaveAttribute('href', '/ngo')
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

  it('previews all three roles, marking unfinished ones as in development', () => {
    setup()
    for (const name of ['NGO', 'Donor', 'Admin']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('In development')).toHaveLength(2)
  })
})
