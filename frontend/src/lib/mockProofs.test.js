import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', async (orig) => ({ ...(await orig()), USE_MOCKS: true }))

import * as ngo from '../features/ngo-reservations/mockApi'
import * as admin from '../features/admin-impact/api'
import { fetchDocumentUrl } from './documents'
import { getMockFile, listMockProofs, mockProofSummary, reviewMockProof } from './mockProofs'

// Demo mode must behave like the real stack: a proof of donation uploaded as an NGO is the proof an admin sees,
// can open and can review.
describe('demo mode: proof of donation from NGO to admin', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:demo-file'), revokeObjectURL: vi.fn() }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('a proof uploaded by the NGO appears in the admin queue with its note, listing and donor', async () => {
    await ngo.reserve(2)
    await ngo.completePickup(2)
    const sheet = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' })
    await ngo.submitProof(2, [sheet], 'Fed 45 people at the night shelter')

    const pending = await admin.fetchProofs('pending')
    const mine = pending.find((p) => p.note === 'Fed 45 people at the night shelter')
    expect(mine).toMatchObject({
      review_status: 'pending', listing: { title: 'Wedding buffet surplus', provider_org_name: 'Royal Caterers' }, ngo: { org_name: 'Asha Foundation' },
    })
    expect(getMockFile(mine.document_id)).toBe(sheet)
  })

  it('the admin can open the uploaded file (and a seeded one gets a placeholder)', async () => {
    const mine = listMockProofs().find((p) => p.note === 'Fed 45 people at the night shelter')
    expect(await fetchDocumentUrl(mine.document_id)).toBe('blob:demo-file')
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(getMockFile(mine.document_id))
    await fetchDocumentUrl(5)
    expect(URL.createObjectURL.mock.calls.at(-1)[0]).toBeInstanceOf(Blob)
  })

  it('an admin decision is kept and the NGO sees the outcome on its reservation', async () => {
    const mine = listMockProofs().find((p) => p.note === 'Fed 45 people at the night shelter')
    await admin.reviewProof(mine.id, { decision: 'approved', stars: 5 })
    expect(reviewMockProof(mine.id, 'approved').review_status).toBe('approved')
    expect((await admin.fetchProofs('pending')).some((p) => p.id === mine.id)).toBe(false)
    expect(mockProofSummary(2).status).toBe('approved')
    expect((await ngo.getReservations('completed')).find((r) => r.id === 2).proof_status).toBe('approved')
    await expect(ngo.submitProof(2, [new File(['x'], 'late.png')], '')).rejects.toMatchObject({ code: 'PROOF_ALREADY_APPROVED' })
  })
})
