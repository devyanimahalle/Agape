import { describe, expect, it } from 'vitest'
import { countdownTone, formatCountdown, formatDistance, formatQuantity, isRateable, validateProofFiles } from '../utils'

const T0 = new Date('2026-11-20T09:00:00Z').getTime()
const at = (ms) => new Date(T0 + ms).toISOString()

describe('formatCountdown', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(at(2 * 3600e3 + 15 * 60e3), T0)).toBe('2h 15m left')
    expect(formatCountdown(at(4 * 60e3 + 5e3), T0)).toBe('4m 05s left')
    expect(formatCountdown(at(42e3), T0)).toBe('42s left')
  })
  it('reports a closed window', () => {
    expect(formatCountdown(at(0), T0)).toBe('Window closed')
    expect(formatCountdown(at(-5000), T0)).toBe('Window closed')
  })
  it('classifies urgency', () => {
    expect(countdownTone(at(3 * 3600e3), T0)).toBe('ok')
    expect(countdownTone(at(10 * 60e3), T0)).toBe('urgent')
    expect(countdownTone(at(-1), T0)).toBe('closed')
  })
})

describe('formatters', () => {
  it('formats distance', () => {
    expect(formatDistance(0.35)).toBe('350 m away')
    expect(formatDistance(12.34)).toBe('12.3 km away')
    expect(formatDistance(null)).toBe('Distance unknown')
  })
  it('formats quantity', () => {
    expect(formatQuantity({ quantity: 20, unit: 'kg' })).toBe('20 kg')
    expect(formatQuantity({ quantity: 2.5, unit: 'kg' })).toBe('2.5 kg')
  })
  it('knows which providers are rateable', () => {
    expect(isRateable('restaurant')).toBe(true)
    expect(isRateable('caterer')).toBe(true)
    expect(isRateable('general')).toBe(false)
  })
})

describe('validateProofFiles', () => {
  const file = (name, type, size = 10) => ({ name, type, size })
  it('requires at least one file', () => {
    expect(validateProofFiles([])).toMatch(/at least one/i)
  })
  it('accepts pdf, jpg and png', () => {
    expect(validateProofFiles([file('a.png', 'image/png'), file('b.pdf', 'application/pdf')])).toBeNull()
  })
  it('rejects other types, oversize and empty files', () => {
    expect(validateProofFiles([file('a.exe', 'application/x-msdownload')])).toMatch(/only PDF, JPG or PNG/)
    expect(validateProofFiles([file('a.png', 'image/png', 11 * 1024 * 1024)])).toMatch(/10 MB/)
    expect(validateProofFiles([file('a.png', 'image/png', 0)])).toMatch(/empty/)
  })
})
