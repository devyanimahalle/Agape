import { describe, it, expect } from 'vitest'
import { homeForRole, safeNext } from './routes'

describe('routes helpers', () => {
  it('maps roles to home screens', () => {
    expect(homeForRole('ngo')).toBe('/ngo')
    expect(homeForRole('provider')).toBe('/provider')
    expect(homeForRole('donor')).toBe('/provider')
    expect(homeForRole('admin')).toBe('/admin')
    expect(homeForRole('???')).toBe('/')
  })

  it('accepts only safe relative next paths', () => {
    expect(safeNext('/ngo/reservations?x=1')).toBe('/ngo/reservations?x=1')
    expect(safeNext('//evil.com')).toBeNull()
    expect(safeNext('/\\evil.com')).toBeNull()
    expect(safeNext('https://evil.com')).toBeNull()
    expect(safeNext('/login')).toBeNull()
    expect(safeNext(null)).toBeNull()
  })
})
