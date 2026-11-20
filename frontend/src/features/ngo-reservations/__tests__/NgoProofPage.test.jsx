import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import NgoProofPage from '../NgoProofPage'
import { apiError, reservation } from './fixtures'

vi.mock('../api')

function Reservations() {
  return <p>Reservations page: {useLocation().state?.notice}</p>
}

const png = (name = 'distribution.png') => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], name, { type: 'image/png' })

const renderPage = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/ngo/pickups/1/proof', state }]}>
      <Routes>
        <Route path="/ngo/pickups/:id/proof" element={<NgoProofPage />} />
        <Route path="/ngo/reservations" element={<Reservations />} />
      </Routes>
    </MemoryRouter>,
  )

const collected = (o = {}) => reservation({ id: 1, title: 'Veg biryani', status: 'completed', proof_status: 'none', proof_count: 0, ...o })

beforeEach(() => {
  vi.resetAllMocks()
  api.getReservations.mockResolvedValue([collected()])
})

describe('NgoProofPage (Proof of donation)', () => {
  it('is a page with an orange band titled Proof of donation and a form surface', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Proof of donation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Veg biryani' })).toBeInTheDocument()
    expect(screen.getByText('Pickup confirmed')).toBeInTheDocument()
    expect(screen.getByLabelText(/Proof of donation files/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Distribution note/)).toBeInTheDocument()
  })

  it('explains what counts as proof of donation and the file rules', async () => {
    renderPage()
    expect(await screen.findByText(/geotagged distribution photo/)).toBeInTheDocument()
    expect(screen.getByText(/signed distribution or beneficiary sheet/)).toBeInTheDocument()
    expect(screen.getByText(/PDF, JPG or PNG, up to 10 MB each/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/proof of pickup|proof of collection/i)
  })

  it('greets the NGO right after confirming the pickup', async () => {
    renderPage({ justConfirmed: true })
    expect(await screen.findByText('Pickup confirmed. Now add proof that the food was donated.')).toBeInTheDocument()
  })

  it('submits the files and the note, then returns to reservations with a notice', async () => {
    api.submitProof.mockResolvedValue({ proof_status: 'pending' })
    renderPage()
    const a = png('photo.png')
    const b = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' })
    await userEvent.upload(await screen.findByLabelText(/Proof of donation files/), [a, b])
    await userEvent.type(screen.getByLabelText(/Distribution note/), '60 people fed at the shelter')
    await userEvent.click(screen.getByRole('button', { name: 'Submit proof of donation' }))
    await waitFor(() => expect(api.submitProof).toHaveBeenCalledWith(1, [a, b], '60 people fed at the shelter'))
    expect(await screen.findByText(/Reservations page: Proof of donation submitted for “Veg biryani”/)).toBeInTheDocument()
  })

  it('needs at least one file before it can be submitted', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Submit proof of donation' })).toBeDisabled()
    expect(api.submitProof).not.toHaveBeenCalled()
  })

  it('lets files be removed again', async () => {
    renderPage()
    await userEvent.upload(await screen.findByLabelText(/Proof of donation files/), png('one.png'))
    await userEvent.click(screen.getByRole('button', { name: 'Remove one.png' }))
    expect(screen.queryByText('one.png')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit proof of donation' })).toBeDisabled()
  })

  it('rejects a disallowed file type client-side', async () => {
    renderPage()
    const bad = new File(['x'], 'run.exe', { type: 'application/x-msdownload' })
    await userEvent.upload(await screen.findByLabelText(/Proof of donation files/), bad, { applyAccept: false })
    await userEvent.click(screen.getByRole('button', { name: 'Submit proof of donation' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/only PDF, JPG or PNG/)
    expect(api.submitProof).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps the form', async () => {
    api.submitProof.mockRejectedValue(apiError(400, 'INVALID_FILE_TYPE', 'Only PDF, JPG or PNG files are allowed'))
    renderPage()
    await userEvent.upload(await screen.findByLabelText(/Proof of donation files/), png())
    await userEvent.click(screen.getByRole('button', { name: 'Submit proof of donation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only PDF/)
    expect(screen.getByRole('button', { name: 'Submit proof of donation' })).toBeInTheDocument()
  })

  it('lets the NGO come back later', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Do this later' })).toHaveAttribute('href', '/ngo/reservations')
  })

  it('tells the NGO about files already awaiting review and allows adding more', async () => {
    api.getReservations.mockResolvedValue([collected({ proof_status: 'pending', proof_count: 2 })])
    renderPage()
    expect(await screen.findByText(/already uploaded 2 files/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Proof of donation files/)).toBeInTheDocument()
  })

  it('asks for a new upload after a rejection', async () => {
    api.getReservations.mockResolvedValue([collected({ proof_status: 'rejected', proof_count: 1 })])
    renderPage()
    expect(await screen.findByText(/did not approve the earlier proof of donation/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Proof of donation files/)).toBeInTheDocument()
  })

  it('shows no form once the proof of donation is approved', async () => {
    api.getReservations.mockResolvedValue([collected({ proof_status: 'approved', proof_count: 1 })])
    renderPage()
    expect(await screen.findByText('Proof of donation approved')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Proof of donation files/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to my reservations' })).toHaveAttribute('href', '/ngo/reservations')
  })

  it('asks to confirm the pickup first when it is only reserved', async () => {
    api.getReservations.mockResolvedValue([reservation({ id: 1, status: 'reserved' })])
    renderPage()
    expect(await screen.findByText('Confirm the pickup first')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Proof of donation files/)).not.toBeInTheDocument()
  })

  it('says so when the pickup is not found, and when loading fails', async () => {
    api.getReservations.mockResolvedValueOnce([])
    const { unmount } = renderPage()
    expect(await screen.findByText('We could not find that pickup')).toBeInTheDocument()
    unmount()
    api.getReservations.mockRejectedValue(apiError(500, 'ERROR', 'boom'))
    renderPage()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('boom')).toBeInTheDocument()
  })
})
