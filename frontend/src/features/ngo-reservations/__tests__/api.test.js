import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.setItem('access_token', 'tok123')
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const lastCall = () => {
  const [url, init] = fetch.mock.calls.at(-1)
  return { url: new URL(url), init }
}

describe('api (real HTTP layer)', () => {
  it('GET /board sends lat/lng and the Bearer token', async () => {
    fetch.mockReturnValue(json(200, [{ id: 1 }]))
    expect(await api.getBoard(28.6, 77.2)).toEqual([{ id: 1 }])
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/v1/board')
    expect(url.searchParams.get('lat')).toBe('28.6')
    expect(url.searchParams.get('lng')).toBe('77.2')
    expect(init.headers.Authorization).toBe('Bearer tok123')
  })

  it('omits empty params and uses the right paths and methods', async () => {
    fetch.mockReturnValue(json(200, []))
    await api.getReservations(undefined)
    expect(lastCall().url.search).toBe('')
    await api.getReservations('reserved')
    expect(lastCall().url.searchParams.get('status')).toBe('reserved')
    await api.geocode('Saket Delhi')
    expect(lastCall().url.pathname).toBe('/api/v1/geocode')
    expect(lastCall().url.searchParams.get('q')).toBe('Saket Delhi')
    await api.reserve(5)
    expect(lastCall().url.pathname).toBe('/api/v1/listings/5/reserve')
    expect(lastCall().init.method).toBe('POST')
    await api.cancelReservation(5)
    expect(lastCall().url.pathname).toBe('/api/v1/listings/5/cancel-reservation')
  })

  it('completePickup posts multipart with repeated files[] and a note', async () => {
    fetch.mockReturnValue(json(200, {}))
    const f1 = new File(['a'], 'a.png', { type: 'image/png' })
    const f2 = new File(['b'], 'b.pdf', { type: 'application/pdf' })
    await api.completePickup(9, [f1, f2], 'done')
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/v1/listings/9/complete')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.getAll('files')).toHaveLength(2)
    expect(init.body.get('note')).toBe('done')
    expect(init.headers['Content-Type']).toBeUndefined() // browser must set the multipart boundary
  })

  it('rateProvider posts JSON', async () => {
    fetch.mockReturnValue(json(201, {}))
    await api.rateProvider(3, { stars: 5, comment: 'great' })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/v1/listings/3/rate-provider')
    expect(JSON.parse(init.body)).toEqual({ stars: 5, comment: 'great' })
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('maps the contract error shape to ApiError', async () => {
    fetch.mockReturnValue(json(409, { detail: 'taken', code: 'ALREADY_RESERVED' }))
    await expect(api.reserve(1)).rejects.toMatchObject({ status: 409, code: 'ALREADY_RESERVED', detail: 'taken' })
    fetch.mockReturnValue(json(500, null))
    await expect(api.reserve(1)).rejects.toMatchObject({ status: 500, detail: 'Something went wrong' })
  })

  it('maps network failures to a friendly error', async () => {
    fetch.mockRejectedValue(new TypeError('failed'))
    await expect(api.getMe()).rejects.toMatchObject({ code: 'NETWORK', status: 0 })
  })

  it('works without a stored token', async () => {
    localStorage.clear()
    fetch.mockReturnValue(json(200, {}))
    await api.getMe()
    expect(lastCall().init.headers.Authorization).toBeUndefined()
  })
})
