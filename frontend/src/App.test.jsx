import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { it, expect } from 'vitest'
import App from './App'

it('renders the home shell', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Agape' })).toBeInTheDocument()
})
