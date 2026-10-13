import { describe, expect, it } from 'vitest'
import { categoryFrom, scoresFrom, trendRangeFrom } from './admin.schema'

describe('trendRangeFrom', () => {
  it('accepts the offered ranges and falls back to thirty days', () => {
    expect(trendRangeFrom('7')).toBe(7)
    expect(trendRangeFrom('90')).toBe(90)
    expect(trendRangeFrom(null)).toBe(30)
    expect(trendRangeFrom('14')).toBe(30)
    expect(trendRangeFrom('x')).toBe(30)
  })
})

describe('scoresFrom', () => {
  it('reads the scores of a moderation run and nothing else', () => {
    expect(scoresFrom({ SPAM: 0.71, HATE: 0 })).toEqual({ SPAM: 0.71, HATE: 0 })
    expect(scoresFrom(null)).toEqual({})
    expect(scoresFrom({ SPAM: 'high' })).toEqual({})
    expect(scoresFrom('x')).toEqual({})
  })
})

describe('categoryFrom', () => {
  it('accepts only the categories a block can name', () => {
    expect(categoryFrom('SPAM')).toBe('SPAM')
    expect(categoryFrom('spam')).toBeUndefined()
  })
})
