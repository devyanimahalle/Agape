import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import ProviderVerificationPage from '../ProviderVerificationPage'
import AdminVerificationsPage from '../AdminVerificationsPage'

vi.mock('../api')

// ── helpers ───────────────────────────────────────────────────────────────────
const notSubmitted = () => ({ status: 'not_submitted', rejection_reason: null })
const pending = () => ({ status: 'pending', rejection_reason: null, entity_name: "Ravi's Kitchen", masked_pan: 'XXXXX1234F', masked_aadhaar: 'XXXX-XXXX-1098', fssai_number: '11112222333344' })
const approved = () => ({ ...pending(), status: 'approved' })
const rejected = () => ({ status: 'rejected', rejection_reason: 'PAN does not match records' })

const mockVerifications = () => [
  {
    id: 1, type: 'provider', status: 'pending', user_id: 101, user_email: 'ravi@demo.com', org_name: 'Ravi Kitchen', entity_name: "Ravi's Kitchen",
    submitted_at: new Date().toISOString(), pan_masked: 'XXXXX1234F', aadhaar_masked: 'XXXX-XXXX-1098', fssai_number: '11112222333344',
    documents: [{ id: 11, kind: 'business_proof', label: 'Business registration' }, { id: 12, kind: 'fssai_cert', label: 'FSSAI certificate' }],
  },
  {
    id: 2, type: 'ngo', status: 'pending', user_id: 202, user_email: 'asha@ngo.demo', submitted_at: new Date().toISOString(),
    documents: [{ id: 21, kind: 'ngo_reg', label: 'NGO registration' }], org_name: 'Asha Foundation', reg_number: 'REG/001',
  },
]

const bizFile = (name = 'biz.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' })
const renderProvider = () => render(<MemoryRouter><ProviderVerificationPage /></MemoryRouter>)

async function fillStep1({ pan = 'ABCDE1234F', aadhaar = '987654321098' } = {}) {
  await userEvent.type(await screen.findByLabelText(/Business name/), "Ravi's Kitchen")
  await userEvent.upload(screen.getByLabelText(/Business registration document/), bizFile())
  await userEvent.type(screen.getByLabelText('PAN *'), pan)
  await userEvent.type(screen.getByLabelText(/Aadhaar number/), aadhaar)
}

async function goToStep2() {
  await fillStep1()
  await userEvent.click(screen.getByRole('button', { name: 'Continue to step 2' }))
  return screen.findByLabelText(/FSSAI licence number/)
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getProviderVerification.mockResolvedValue(notSubmitted())
  api.listVerifications.mockResolvedValue(mockVerifications())
})

// ─────────────────────────────────────────────────────────────────────────────
// ProviderVerificationPage: one wizard, one request
// ─────────────────────────────────────────────────────────────────────────────
describe('ProviderVerificationPage: wizard', () => {
  it('starts on step 1 and keeps step 2 locked', async () => {
    renderProvider()
    expect(await screen.findByLabelText('PAN *')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /FSSAI licence/i })).toBeDisabled()
  })

  it('continuing from step 1 sends nothing and opens step 2', async () => {
    renderProvider()
    await goToStep2()
    expect(api.submitProviderVerification).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: /FSSAI licence/i })).not.toBeDisabled()
    expect(screen.getByText(/reviews both steps together/i)).toBeInTheDocument()
  })

  it('submitting step 2 sends step 1 and step 2 together in ONE call', async () => {
    api.submitProviderVerification.mockResolvedValue(pending())
    renderProvider()
    await userEvent.type(await goToStep2(), '11112222333344')
    await userEvent.upload(screen.getByLabelText(/FSSAI certificate/), bizFile('cert.pdf'))
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(api.submitProviderVerification).toHaveBeenCalledTimes(1))
    expect(api.submitProviderVerification).toHaveBeenCalledWith(expect.objectContaining({
      entity_name: "Ravi's Kitchen", pan: 'ABCDE1234F', aadhaar: '987654321098',
      fssai_number: '11112222333344', business_proof: expect.any(File), fssai_cert: expect.any(File),
    }))
    expect(await screen.findByText('Under review')).toBeInTheDocument()
  })

  it('shows only masked identifiers once submitted, never the raw numbers', async () => {
    api.getProviderVerification.mockResolvedValue(pending())
    renderProvider()
    expect(await screen.findByText('XXXX-XXXX-1098')).toBeInTheDocument()
    expect(screen.getByText('XXXXX1234F')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('987654321098')
    expect(screen.queryByLabelText('PAN *')).not.toBeInTheDocument()
  })

  it('shows the verified state with the detail tiles when approved', async () => {
    api.getProviderVerification.mockResolvedValue(approved())
    renderProvider()
    expect(await screen.findByText('You are verified')).toBeInTheDocument()
    expect(screen.getByText('11112222333344')).toBeInTheDocument()
  })

  it('shows the rejection reason and lets the donor start again', async () => {
    api.getProviderVerification.mockResolvedValue(rejected())
    renderProvider()
    expect(await screen.findByText(/PAN does not match records/)).toBeInTheDocument()
    expect(screen.getByLabelText('PAN *')).toBeInTheDocument()
  })

  it('links to the listings page', async () => {
    renderProvider()
    expect(await screen.findByRole('link', { name: 'Open listings' })).toHaveAttribute('href', '/provider/listings')
  })
})

describe('ProviderVerificationPage: client validation', () => {
  it('rejects invalid PAN on step 1', async () => {
    renderProvider()
    await fillStep1({ pan: 'BAD' })
    await userEvent.click(screen.getByRole('button', { name: 'Continue to step 2' }))
    expect(screen.getByText(/PAN must be 10 characters/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/FSSAI licence number/)).not.toBeInTheDocument()
  })

  it('rejects invalid Aadhaar on step 1', async () => {
    renderProvider()
    await fillStep1({ aadhaar: '123' })
    await userEvent.click(screen.getByRole('button', { name: 'Continue to step 2' }))
    expect(screen.getByText(/12 digits/i)).toBeInTheDocument()
  })

  it('requires the business name and document on step 1', async () => {
    renderProvider()
    await userEvent.type(await screen.findByLabelText('PAN *'), 'ABCDE1234F')
    await userEvent.type(screen.getByLabelText(/Aadhaar number/), '987654321098')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to step 2' }))
    expect(screen.getByText(/Business name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/Upload your business registration document/i)).toBeInTheDocument()
  })

  it('rejects an FSSAI number that is not 14 digits and sends nothing', async () => {
    renderProvider()
    await userEvent.type(await goToStep2(), '1234')
    await userEvent.upload(screen.getByLabelText(/FSSAI certificate/), bizFile())
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText(/14 digits/i)).toBeInTheDocument()
    expect(api.submitProviderVerification).not.toHaveBeenCalled()
  })

  it('requires the FSSAI certificate', async () => {
    renderProvider()
    await userEvent.type(await goToStep2(), '11112222333344')
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText(/Upload your FSSAI certificate/i)).toBeInTheDocument()
    expect(api.submitProviderVerification).not.toHaveBeenCalled()
  })

  it('can go back to step 1 and keeps what was typed', async () => {
    renderProvider()
    await goToStep2()
    await userEvent.click(screen.getByRole('button', { name: 'Back to step 1' }))
    expect(screen.getByLabelText(/Business name/)).toHaveValue("Ravi's Kitchen")
    expect(screen.getByLabelText('PAN *')).toHaveValue('ABCDE1234F')
  })
})

describe('ProviderVerificationPage: error display', () => {
  it('shows a server error in an alert', async () => {
    api.submitProviderVerification.mockRejectedValue(Object.assign(new Error('Duplicate pending'), { detail: 'A verification request is already pending review', status: 409 }))
    renderProvider()
    await userEvent.type(await goToStep2(), '11112222333344')
    await userEvent.upload(screen.getByLabelText(/FSSAI certificate/), bizFile())
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/already pending/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AdminVerificationsPage
// ─────────────────────────────────────────────────────────────────────────────
describe('AdminVerificationsPage: one combined donor request', () => {
  it('shows identity, business and FSSAI details with every document on one card', async () => {
    render(<AdminVerificationsPage />)
    const card = (await screen.findByRole('heading', { name: 'Ravi Kitchen' })).closest('article')
    expect(within(card).getByText('XXXXX1234F')).toBeInTheDocument()
    expect(within(card).getByText('XXXX-XXXX-1098')).toBeInTheDocument()
    expect(within(card).getByText('11112222333344')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'View Business registration' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'View FSSAI certificate' })).toBeInTheDocument()
    expect(within(card).getAllByRole('button', { name: 'Approve' })).toHaveLength(1)
  })

  it('offers only the donor and NGO types in the filter', async () => {
    render(<AdminVerificationsPage />)
    const select = await screen.findByLabelText('Type')
    expect([...select.options].map((o) => o.value)).toEqual(['', 'provider', 'ngo'])
  })
})

describe('AdminVerificationsPage: reject needs reason', () => {
  it('shows inline error when rejection reason is empty', async () => {
    render(<AdminVerificationsPage />)
    const rejectBtns = await screen.findAllByRole('button', { name: 'Reject' })
    await userEvent.click(rejectBtns[0])
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/required/i)
    expect(api.decideVerification).not.toHaveBeenCalled()
  })

  it('submits rejection with a reason', async () => {
    api.decideVerification.mockResolvedValue({})
    render(<AdminVerificationsPage />)
    const rejectBtns = await screen.findAllByRole('button', { name: 'Reject' })
    await userEvent.click(rejectBtns[0])
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Rejection reason/), { target: { value: 'Docs unclear' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() =>
      expect(api.decideVerification).toHaveBeenCalledWith(1, { decision: 'reject', rejection_reason: 'Docs unclear' })
    )
  })

  it('approves without a modal', async () => {
    api.decideVerification.mockResolvedValue({})
    render(<AdminVerificationsPage />)
    const approveBtns = await screen.findAllByRole('button', { name: 'Approve' })
    await userEvent.click(approveBtns[0])
    await waitFor(() =>
      expect(api.decideVerification).toHaveBeenCalledWith(1, { decision: 'approve', rejection_reason: undefined })
    )
  })
})

describe('AdminVerificationsPage: blob URL revoked on close', () => {
  it('calls revokeObjectURL when the document modal is closed', async () => {
    const fakeUrl = 'blob:http://localhost/test-123'
    api.fetchDocumentUrl.mockResolvedValue(fakeUrl)
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')

    render(<AdminVerificationsPage />)
    const viewBtns = await screen.findAllByRole('button', { name: 'View Business registration' })
    await userEvent.click(viewBtns[0])
    await waitFor(() => expect(screen.getByTitle('Verification document')).toBeInTheDocument())
    expect(api.fetchDocumentUrl).toHaveBeenCalledWith(11)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl)
    revokeSpy.mockRestore()
  })

  it('shows friendly message on 404 document', async () => {
    api.fetchDocumentUrl.mockRejectedValue(Object.assign(new Error('not found'), { detail: 'Document not found or already deleted.', status: 404 }))
    render(<AdminVerificationsPage />)
    const viewBtns = await screen.findAllByRole('button', { name: 'View NGO registration' })
    await userEvent.click(viewBtns[0])
    expect(await screen.findByText(/Document not found or already deleted/i)).toBeInTheDocument()
  })
})
