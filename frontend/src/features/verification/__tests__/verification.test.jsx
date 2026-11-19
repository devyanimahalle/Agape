import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import ProviderVerificationPage from '../ProviderVerificationPage'
import AdminVerificationsPage from '../AdminVerificationsPage'

vi.mock('../api')

// ── helpers ───────────────────────────────────────────────────────────────────
const notSubmitted = () => ({
  step1: { status: 'not_submitted', rejection_reason: null },
  step2: { status: 'not_submitted', rejection_reason: null },
  overall: 'not_submitted',
})
const step1Pending = () => ({
  step1: { status: 'pending', rejection_reason: null },
  step2: { status: 'not_submitted', rejection_reason: null },
  overall: 'pending',
})
const step1Approved = () => ({
  step1: { status: 'approved', rejection_reason: null, pan_masked: 'AB***Z', aadhaar_masked: '****5678' },
  step2: { status: 'not_submitted', rejection_reason: null },
  overall: 'pending',
})
const step1Rejected = () => ({
  step1: { status: 'rejected', rejection_reason: 'PAN does not match records' },
  step2: { status: 'not_submitted', rejection_reason: null },
  overall: 'rejected',
})
const mockVerifications = () => [
  { id: 1, type: 'provider_step1', status: 'pending', user_id: 101, user_email: 'ravi@demo.com', submitted_at: new Date().toISOString(), document_ids: ['doc-1'], pan_masked: 'AB***Z', aadhaar_masked: '****5678' },
  { id: 2, type: 'ngo', status: 'pending', user_id: 202, user_email: 'asha@ngo.demo', submitted_at: new Date().toISOString(), document_ids: ['doc-2'], org_name: 'Asha Foundation', reg_number: 'REG/001' },
]

const bizFile = () => new File(['%PDF-1.4'], 'biz.pdf', { type: 'application/pdf' })

// Fill every required step 1 field; pass overrides to test a single invalid value.
async function fillStep1({ pan = 'ABCDE1234F', aadhaar = '123456789012' } = {}) {
  await userEvent.type(await screen.findByLabelText(/Business name/), "Ravi's Kitchen")
  await userEvent.upload(screen.getByLabelText(/Business registration document/), bizFile())
  await userEvent.type(screen.getByLabelText('PAN *'), pan)
  await userEvent.type(screen.getByLabelText(/Aadhaar number/), aadhaar)
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getProviderVerification.mockResolvedValue(notSubmitted())
  api.listVerifications.mockResolvedValue(mockVerifications())
})

// ─────────────────────────────────────────────────────────────────────────────
// ProviderVerificationPage
// ─────────────────────────────────────────────────────────────────────────────
describe('ProviderVerificationPage — stepper states', () => {
  it('shows step 1 form when not submitted', async () => {
    render(<ProviderVerificationPage />)
    expect(await screen.findByLabelText('PAN *')).toBeInTheDocument()
    expect(screen.getByLabelText(/Aadhaar number/)).toBeInTheDocument()
  })

  it('step 2 tab is disabled when step 1 is not approved', async () => {
    api.getProviderVerification.mockResolvedValue(notSubmitted())
    render(<ProviderVerificationPage />)
    await screen.findByLabelText('PAN *')
    const step2Tab = screen.getByRole('tab', { name: /FSSAI licence/i })
    expect(step2Tab).toBeDisabled()
  })

  it('step 2 tab is disabled when step 1 is pending', async () => {
    api.getProviderVerification.mockResolvedValue(step1Pending())
    render(<ProviderVerificationPage />)
    await screen.findByText(/under review/i)
    const step2Tab = screen.getByRole('tab', { name: /FSSAI licence/i })
    expect(step2Tab).toBeDisabled()
  })

  it('step 2 tab is enabled when step 1 is approved', async () => {
    api.getProviderVerification.mockResolvedValue(step1Approved())
    render(<ProviderVerificationPage />)
    await screen.findByText(/Identity documents have been verified/i)
    const step2Tab = screen.getByRole('tab', { name: /FSSAI licence/i })
    expect(step2Tab).not.toBeDisabled()
  })

  it('shows pending message after step 1 submitted', async () => {
    api.getProviderVerification.mockResolvedValue(notSubmitted())
    api.submitProviderStep1.mockResolvedValue(step1Pending())
    render(<ProviderVerificationPage />)
    await fillStep1()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText(/under review/i)).toBeInTheDocument()
  })

  it('shows rejection reason and Resubmit button when step 1 rejected', async () => {
    api.getProviderVerification.mockResolvedValue(step1Rejected())
    render(<ProviderVerificationPage />)
    expect(await screen.findByText(/PAN does not match records/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resubmit' })).toBeInTheDocument()
  })
})

describe('ProviderVerificationPage — client validation', () => {
  it('rejects invalid PAN', async () => {
    render(<ProviderVerificationPage />)
    await fillStep1({ pan: 'BAD' })
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText(/PAN must be 10 characters/i)).toBeInTheDocument()
    expect(api.submitProviderStep1).not.toHaveBeenCalled()
  })

  it('rejects invalid Aadhaar', async () => {
    render(<ProviderVerificationPage />)
    await fillStep1({ aadhaar: '123' })
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText(/12 digits/i)).toBeInTheDocument()
    expect(api.submitProviderStep1).not.toHaveBeenCalled()
  })

  it('requires the business document and name before submitting step 1', async () => {
    render(<ProviderVerificationPage />)
    await userEvent.type(await screen.findByLabelText('PAN *'), 'ABCDE1234F')
    await userEvent.type(screen.getByLabelText(/Aadhaar number/), '123456789012')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText(/Business name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/Upload your business registration document/i)).toBeInTheDocument()
    expect(api.submitProviderStep1).not.toHaveBeenCalled()
  })

  it('sends the entity name, document, PAN and Aadhaar to the api', async () => {
    api.submitProviderStep1.mockResolvedValue(step1Pending())
    render(<ProviderVerificationPage />)
    await fillStep1()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(api.submitProviderStep1).toHaveBeenCalledWith(
      expect.objectContaining({ entity_name: "Ravi's Kitchen", pan: 'ABCDE1234F', aadhaar: '123456789012', business_proof: expect.any(File) }),
    ))
  })
})

describe('ProviderVerificationPage — step 2 (FSSAI)', () => {
  const openStep2 = async () => {
    api.getProviderVerification.mockResolvedValue(step1Approved())
    render(<ProviderVerificationPage />)
    await screen.findByText(/Identity documents have been verified/i)
    await userEvent.click(screen.getByRole('tab', { name: /FSSAI licence/i }))
  }

  it('rejects an FSSAI number that is not 14 digits', async () => {
    await openStep2()
    await userEvent.type(screen.getByLabelText(/Business name/), "Ravi's Kitchen")
    await userEvent.type(screen.getByLabelText(/FSSAI licence number/), '1234')
    await userEvent.upload(screen.getByLabelText(/FSSAI certificate/), bizFile())
    await userEvent.click(screen.getByRole('button', { name: 'Upload certificate' }))
    expect(screen.getByText(/14 digits/i)).toBeInTheDocument()
    expect(api.submitProviderStep2).not.toHaveBeenCalled()
  })

  it('submits a valid FSSAI number with the certificate', async () => {
    api.submitProviderStep2.mockResolvedValue({ ...step1Approved(), step2: { status: 'pending', rejection_reason: null } })
    await openStep2()
    await userEvent.type(screen.getByLabelText(/Business name/), "Ravi's Kitchen")
    await userEvent.type(screen.getByLabelText(/FSSAI licence number/), '12345678901234')
    await userEvent.upload(screen.getByLabelText(/FSSAI certificate/), bizFile())
    await userEvent.click(screen.getByRole('button', { name: 'Upload certificate' }))
    await waitFor(() => expect(api.submitProviderStep2).toHaveBeenCalledWith(
      expect.objectContaining({ fssai_number: '12345678901234', entity_name: "Ravi's Kitchen", fssai_cert: expect.any(File) }),
    ))
    expect(await screen.findByText(/under review/i)).toBeInTheDocument()
  })
})

describe('ProviderVerificationPage — error display', () => {
  it('shows server error in alert', async () => {
    api.submitProviderStep1.mockRejectedValue(Object.assign(new Error('Duplicate pending'), { detail: 'A pending submission already exists', status: 409 }))
    render(<ProviderVerificationPage />)
    await fillStep1()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/pending submission/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AdminVerificationsPage
// ─────────────────────────────────────────────────────────────────────────────
describe('AdminVerificationsPage — reject needs reason', () => {
  it('shows inline error when rejection reason is empty', async () => {
    render(<AdminVerificationsPage />)
    // Open the reject modal for the first pending item
    const rejectBtns = await screen.findAllByRole('button', { name: 'Reject' })
    await userEvent.click(rejectBtns[0])
    // Click confirm without typing a reason
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
    const reasonField = within(dialog).getByLabelText(/Rejection reason/)
    fireEvent.change(reasonField, { target: { value: 'Docs unclear' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() =>
      expect(api.decideVerification).toHaveBeenCalledWith(1, { decision: 'reject', rejection_reason: 'Docs unclear' })
    )
  })

  it('approves without a modal', async () => {
    api.decideVerification.mockResolvedValue({})
    // beforeEach sets listVerifications to return items for both initial load and refetch
    render(<AdminVerificationsPage />)
    const approveBtns = await screen.findAllByRole('button', { name: 'Approve' })
    await userEvent.click(approveBtns[0])
    await waitFor(() =>
      expect(api.decideVerification).toHaveBeenCalledWith(1, { decision: 'approve', rejection_reason: undefined })
    )
  })
})

describe('AdminVerificationsPage — blob URL revoked on close', () => {
  it('calls revokeObjectURL when the document modal is closed', async () => {
    const fakeUrl = 'blob:http://localhost/test-123'
    api.fetchDocumentUrl.mockResolvedValue(fakeUrl)
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')

    render(<AdminVerificationsPage />)
    // Click "View document" on first card
    const viewBtns = await screen.findAllByRole('button', { name: 'View document' })
    await userEvent.click(viewBtns[0])

    // Wait for the iframe to appear (document loaded)
    await waitFor(() => expect(screen.getByTitle('Verification document')).toBeInTheDocument())

    // Close the modal
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl)
    revokeSpy.mockRestore()
  })

  it('shows friendly message on 404 document', async () => {
    api.fetchDocumentUrl.mockRejectedValue(Object.assign(new Error('not found'), { detail: 'Document not found or already deleted.', status: 404 }))
    render(<AdminVerificationsPage />)
    const viewBtns = await screen.findAllByRole('button', { name: 'View document' })
    await userEvent.click(viewBtns[0])
    expect(await screen.findByText(/Document not found or already deleted/i)).toBeInTheDocument()
  })
})
