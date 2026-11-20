import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), USE_MOCKS: false }))

import { decideVerification, getProviderVerification, listVerifications, submitProviderVerification } from '../api'

function reply(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

describe('verification api adapter (real backend shapes)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('maps the provider status to the page shape', async () => {
    fetch.mockReturnValue(reply({
      status: 'rejected', reason: 'Blurry scan', entity_name: 'Ravi', masked_pan: 'XXXXX1234F',
      masked_aadhaar: 'XXXX-XXXX-1098', fssai_number: '11112222333344',
    }))
    const d = await getProviderVerification()
    expect(String(fetch.mock.calls[0][0])).toContain('/verification/provider/status')
    expect(d).toMatchObject({ status: 'rejected', rejection_reason: 'Blurry scan', masked_aadhaar: 'XXXX-XXXX-1098' })
  })

  it('sends step 1 and step 2 as one multipart request to /verification/provider', async () => {
    fetch.mockReturnValueOnce(reply({ id: 1, status: 'pending' }))
      .mockReturnValueOnce(reply({ status: 'pending', reason: null }))
    const doc = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    const cert = new File(['y'], 'c.pdf', { type: 'application/pdf' })
    const out = await submitProviderVerification({
      entity_name: 'Ravi', business_proof: doc, pan: 'ABCDE1234F', aadhaar: '987654321098', fssai_number: '11112222333344', fssai_cert: cert,
    })
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toContain('/verification/provider')
    expect(String(url)).not.toContain('step')
    expect(init.method).toBe('POST')
    const body = init.body
    expect(body.get('entity_name')).toBe('Ravi')
    expect(body.get('pan_number')).toBe('ABCDE1234F')
    expect(body.get('aadhaar_number')).toBe('987654321098')
    expect(body.get('fssai_number')).toBe('11112222333344')
    expect(body.get('business_proof')).toBeInstanceOf(File)
    expect(body.get('fssai_cert')).toBeInstanceOf(File)
    expect(fetch).toHaveBeenCalledTimes(2) // the submit, then a status re-read
    expect(out.status).toBe('pending')
  })

  it('maps admin rows to the page shape, with documents and masked values', async () => {
    fetch.mockReturnValue(reply([
      {
        id: 1, subject_type: 'provider', status: 'pending', user_email: 'a@x.com', created_at: '2026-01-01T00:00:00Z',
        masked_pan: 'XXXXX1234F', masked_aadhaar: 'XXXX-XXXX-1098', fssai_number: '11112222333344', entity_name: 'Ravi',
        documents: [{ id: 4, kind: 'business_proof', label: 'Business registration' }, { id: 5, kind: 'fssai_cert', label: 'FSSAI certificate' }],
      },
      { id: 3, subject_type: 'ngo', status: 'pending', user_email: 'c@x.com', entity_name: 'REG/1', org_name: 'Asha', created_at: '2026-01-01T00:00:00Z', documents: [{ id: 7, kind: 'ngo_reg', label: 'NGO registration' }] },
    ]))
    const all = await listVerifications({})
    expect(all.map((v) => v.type)).toEqual(['provider', 'ngo'])
    expect(all[0].documents.map((d) => d.id)).toEqual([4, 5])
    expect(all[0].pan_masked).toBe('XXXXX1234F')
    expect(all[1].reg_number).toBe('REG/1')
  })

  it('passes the type filter straight to the backend', async () => {
    fetch.mockReturnValue(reply([]))
    await listVerifications({ type: 'provider', status: 'pending' })
    const url = String(fetch.mock.calls[0][0])
    expect(url).toContain('type=provider')
    expect(url).toContain('status=pending')
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
