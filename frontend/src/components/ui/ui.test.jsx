import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button, Card, Badge, StatusPill, EmptyState, LoadingState, Modal } from '.'

describe('ui kit', () => {
  it('Button fires onClick, honours disabled, and never uses yellow text', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button variant="primary" onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button')).toHaveClass('bg-primary', 'text-ink')
    expect(screen.getByRole('button').className).not.toMatch(/text-primary|text-highlight/)
    rerender(<Button disabled onClick={onClick}>Go</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('Card and Badge render their content', () => {
    render(<Card><Badge tone="ok">Fine</Badge></Card>)
    expect(screen.getByText('Fine')).toHaveClass('bg-ok-bg')
  })

  it('StatusPill maps statuses to honest labels', () => {
    render(<><StatusPill status="pending" /><StatusPill status="verified" /><StatusPill status="mystery" /></>)
    expect(screen.getByText('Awaiting admin review')).toBeInTheDocument()
    expect(screen.getByText('Admin-verified')).toBeInTheDocument()
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })

  it('EmptyState and LoadingState render', () => {
    render(<><EmptyState title="Nothing yet" action={<button>Add</button>}>Check back soon.</EmptyState><LoadingState /></>)
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('Modal renders only when open, is labelled, and closes on Escape', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<Modal open={false} onClose={onClose} title="Confirm">Body</Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Modal open onClose={onClose} title="Confirm">Body</Modal>)
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
