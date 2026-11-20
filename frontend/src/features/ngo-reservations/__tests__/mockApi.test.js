import { describe, expect, it } from 'vitest'
import * as mock from '../mockApi'

describe('mock API (contract shape for offline development)', () => {
  it('returns the board nearest first with contract fields', async () => {
    const rows = await mock.getBoard(28.6315, 77.2167)
    const d = rows.map((r) => r.distance_km)
    expect(d).toEqual([...d].sort((a, b) => a - b))
    expect(rows[0]).toEqual(expect.objectContaining({ org_name: expect.any(String), distance_km: expect.any(Number), status: 'listed' }))
    expect(rows.find((r) => r.provider_category === 'general').rating_avg).toBeNull()
  })

  it('reserves once, then 409s; cancel puts it back; completing needs no files', async () => {
    await mock.reserve(1)
    await expect(mock.reserve(1)).rejects.toMatchObject({ status: 409, code: 'ALREADY_RESERVED' })
    expect((await mock.getReservations('reserved')).map((r) => r.id)).toContain(1)
    await mock.completePickup(1) // one step, no files
    expect((await mock.getReservations('completed')).map((r) => r.id)).toContain(1)
    await mock.rateProvider(1, { stars: 5 })
    await expect(mock.rateProvider(1, { stars: 4 })).rejects.toMatchObject({ code: 'ALREADY_RATED' })
    await mock.reserve(4)
    expect((await mock.cancelReservation(4)).status).toBe('listed')
  })

  it('proof of donation: needs a collected pickup and a file, then shows up as pending', async () => {
    await mock.reserve(3)
    await expect(mock.submitProof(3, [new File(['x'], 'a.png')], 'n')).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await mock.completePickup(3)
    expect((await mock.getReservations('completed')).find((r) => r.id === 3)).toMatchObject({ proof_status: 'none', proof_count: 0 })
    await expect(mock.submitProof(3, [], 'n')).rejects.toMatchObject({ code: 'PROOF_REQUIRED' })
    const out = await mock.submitProof(3, [new File(['x'], 'a.png'), new File(['y'], 'b.pdf')], 'fed 40 people')
    expect(out).toMatchObject({ listing_id: 3, added: 2, proof_status: 'pending', proof_count: 2 })
    expect((await mock.getReservations('completed')).find((r) => r.id === 3)).toMatchObject({ proof_status: 'pending', proof_count: 2 })
  })
})
