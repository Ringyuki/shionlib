import { describe, expect, it } from 'vitest'
import { formatBytes, formatEta, formatSpeed } from '../../../utils/format'

describe('utils/format (unit)', () => {
  it('formatBytes should auto scale bytes', () => {
    expect(formatBytes(1536, { format: false, decimals: 1 })).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024, { format: false, decimals: 0 })).toBe('1 MB')
  })

  it('formatSpeed should render fallback on invalid speed', () => {
    expect(formatSpeed()).toBe('-')
    expect(formatSpeed(0)).toBe('-')
    expect(formatSpeed(1024)).toContain('/s')
  })

  it('formatEta should render human-readable output', () => {
    expect(formatEta()).toBe('-')
    expect(formatEta(59)).toBe('59s')
    expect(formatEta(125)).toBe('2m 5s')
    expect(formatEta(3661)).toBe('1h 1m 1s')
  })
})
