import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), USE_MOCKS: false }))

import { decideVerification, getProviderVerification, listVerifications } from '../api'

function reply(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

describe('verification api adapter (real backend shapes)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('maps provider status reasons to rejection_reason', async () => {
    fetch.mockReturnValue(reply({
      step1: { status: 'rejected', reason: 'Blurry scan' },
      step2: { status: 'not_submitted', reason: null },
      overall: 'rejected',
    }))
    const d = await getProviderVerification()
    expect(String(fetch.mock.calls[0][0])).toContain('/verification/provider/status')
    expect(d.step1).toEqual({ status: 'rejected', rejection_reason: 'Blurry scan' })
    expect(d.overall).toBe('rejected')
  })

  it('maps admin rows to page types and filters by step', async () => {
    fetch.mockReturnValue(reply([
      { id: 1, subject_type: 'provider', step: 1, status: 'pending', user_email: 'a@x.com', created_at: '2026-01-01T00:00:00Z', document_ids: [4, 5], masked_pan: 'AB***Z' },
      { id: 2, subject_type: 'provider', step: 2, status: 'pending', user_email: 'b@x.com', created_at: '2026-01-01T00:00:00Z', document_ids: [6] },
      { id: 3, subject_type: 'ngo', step: 1, status: 'pending', user_email: 'c@x.com', entity_name: 'REG/1', org_name: 'Asha', created_at: '2026-01-01T00:00:00Z', document_ids: [7] },
    ]))
    const all = await listVerifications({})
    expect(all.map((v) => v.type)).toEqual(['provider_step1', 'provider_step2', 'ngo'])
    expect(all[0].document_ids).toEqual([4, 5])
    expect(all[2].reg_number).toBe('REG/1')
    const step2 = await listVerifications({ type: 'provider_step2' })
    expect(step2.map((v) => v.id)).toEqual([2])
    expect(String(fetch.mock.calls[1][0])).toContain('type=provider')
  })

  it('posts decisions as form data using the backend vocabulary', async () => {
    fetch.mockReturnValue(reply({ id: 1, status: 'rejected' }))
    await decideVerification(1, { decision: 'reject', rejection_reason: 'Unclear' })
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toContain('/admin/verifications/1/decision')
    expect(init.method).toBe('POST')
    expect(init.body.get('decision')).toBe('rejected')
    expect(init.body.get('reason')).toBe('Unclear')
  })
})
