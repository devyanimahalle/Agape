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

  it('reserves once, then 409s; cancel puts it back; complete needs proof', async () => {
    await mock.reserve(1)
    await expect(mock.reserve(1)).rejects.toMatchObject({ status: 409, code: 'ALREADY_RESERVED' })
    expect((await mock.getReservations('reserved')).map((r) => r.id)).toContain(1)
    await expect(mock.completePickup(1, [])).rejects.toMatchObject({ code: 'PROOF_REQUIRED' })
    await mock.completePickup(1, [new File(['x'], 'p.png')])
    expect((await mock.getReservations('completed')).map((r) => r.id)).toContain(1)
    await mock.rateProvider(1, { stars: 5 })
    await expect(mock.rateProvider(1, { stars: 4 })).rejects.toMatchObject({ code: 'ALREADY_RATED' })
    await mock.reserve(4)
    expect((await mock.cancelReservation(4)).status).toBe('listed')
  })
})
