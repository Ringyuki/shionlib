import { describe, expect, it } from 'vitest'
import { trendRangeFrom } from './admin.schema'

describe('trendRangeFrom', () => {
  it('accepts the offered ranges and falls back to thirty days', () => {
    expect(trendRangeFrom('7')).toBe(7)
    expect(trendRangeFrom('90')).toBe(90)
    expect(trendRangeFrom(null)).toBe(30)
    expect(trendRangeFrom('14')).toBe(30)
    expect(trendRangeFrom('x')).toBe(30)
  })
})
