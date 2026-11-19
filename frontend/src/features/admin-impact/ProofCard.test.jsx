import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({ fetchDocumentUrl: vi.fn() }))

import { fetchDocumentUrl } from './api'
import ProofCard from './components/ProofCard'

const proof = (o = {}) => ({
  id: 7, listing_id: 3, ngo_id: 9, document_id: 41, note: 'Handed out at the night shelter', review_status: 'pending',
  created_at: '2026-03-01T10:00:00Z',
  listing: { id: 3, title: 'Veg biryani', food_type: 'cooked', quantity: 20, unit: 'kg', provider_org_name: 'Spice Route' },
  ngo: { id: 9, org_name: 'Helpers' }, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  fetchDocumentUrl.mockResolvedValue('blob:http://localhost/proof-41')
})

describe('admin ProofCard (proof of donation)', () => {
  it('labels everything as proof of donation and shows the NGO note, listing, donor and NGO', () => {
    render(<ProofCard proof={proof()} onReview={vi.fn()} />)
    expect(screen.getByText(/Proof of donation #7/)).toBeInTheDocument()
    expect(screen.getByText('Distribution note')).toBeInTheDocument()
    expect(screen.getByText('Handed out at the night shelter')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Veg biryani' })).toBeInTheDocument()
    expect(screen.getByText('Spice Route')).toBeInTheDocument()
    expect(screen.getByText('Helpers')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review this proof of donation' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/proof of pickup|pickup proof|proof of collection/i)
  })

  it('says when the NGO added no note', () => {
    render(<ProofCard proof={proof({ note: null })} onReview={vi.fn()} />)
    expect(screen.getByText('No note added.')).toBeInTheDocument()
  })

  it('opens the uploaded file for the admin and offers open-in-tab and download', async () => {
    render(<ProofCard proof={proof()} onReview={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'View proof of donation' }))
    const dialog = await screen.findByRole('dialog', { name: 'Proof of donation' })
    await waitFor(() => expect(within(dialog).getByTitle('Proof of donation file')).toHaveAttribute('src', 'blob:http://localhost/proof-41'))
    expect(fetchDocumentUrl).toHaveBeenCalledWith(41)
    const download = within(dialog).getByRole('button', { name: 'Download' }).closest('a')
    expect(download).toHaveAttribute('href', 'blob:http://localhost/proof-41')
    expect(download).toHaveAttribute('download', 'proof-of-donation-7')
    expect(within(dialog).getByRole('button', { name: 'Open in new tab' }).closest('a')).toHaveAttribute('target', '_blank')
  })

  it('revokes the temporary file URL when the viewer closes', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    render(<ProofCard proof={proof()} onReview={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'View proof of donation' }))
    await screen.findByTitle('Proof of donation file')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/proof-41')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    revoke.mockRestore()
  })

  it('explains a missing file instead of failing silently', async () => {
    fetchDocumentUrl.mockRejectedValue(Object.assign(new Error('x'), { detail: 'Document not found or already deleted.' }))
    render(<ProofCard proof={proof()} onReview={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'View proof of donation' }))
    expect(await screen.findByText('Document not found or already deleted.')).toBeInTheDocument()
  })

  it('still reviews with a rating: approval needs stars, rejection does not', async () => {
    const onReview = vi.fn().mockResolvedValue()
    render(<ProofCard proof={proof()} onReview={onReview} />)
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith(7, 'rejected', 0, ''))
  })

  it('a reviewed proof keeps the file link but hides the review form', () => {
    render(<ProofCard proof={proof({ review_status: 'approved' })} onReview={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'View proof of donation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})
