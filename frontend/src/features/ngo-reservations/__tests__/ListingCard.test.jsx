import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ListingCard from '../components/ListingCard'
import { boardItem } from './fixtures'

describe('ListingCard', () => {
  it('shows quantity, labelled estimates, distance, provider and rating', () => {
    render(<ListingCard listing={boardItem()} now={Date.now()} onReserve={() => {}} />)
    expect(screen.getByText(/20 kg · cooked/)).toBeInTheDocument()
    expect(screen.getByText(/≈ 50 meals/)).toBeInTheDocument()
    expect(screen.getAllByText(/estimate/i).length).toBeGreaterThan(0)
    expect(screen.getByText('2.5 km away')).toBeInTheDocument()
    expect(screen.getByText(/Spice Route/)).toBeInTheDocument()
    expect(screen.getByLabelText(/rating 4\.5 out of 5/i)).toBeInTheDocument()
    expect(screen.getByTestId('countdown')).toHaveTextContent(/left/)
  })

  it('hides the rating for general providers (null)', () => {
    render(<ListingCard listing={boardItem({ rating_avg: null, provider_category: 'general' })} now={Date.now()} onReserve={() => {}} />)
    expect(screen.queryByLabelText(/provider rating/i)).not.toBeInTheDocument()
  })

  it('calls onReserve and disables Reserve once the window has closed', async () => {
    const onReserve = vi.fn()
    const { rerender } = render(<ListingCard listing={boardItem()} now={Date.now()} onReserve={onReserve} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }))
    expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    rerender(<ListingCard listing={boardItem()} now={Date.now() + 5 * 3600e3} onReserve={onReserve} />)
    expect(screen.getByRole('button', { name: 'Reserve' })).toBeDisabled()
    expect(screen.getByTestId('countdown')).toHaveTextContent('Window closed')
  })
})
