import { describe, expect, it } from 'vitest'
import { contentLimits, showsExplicit } from './viewer'

describe('showsExplicit', () => {
  it('is true only for a viewer who chose to see everything', () => {
    expect(contentLimits.filter(limit => showsExplicit({ content_limit: limit }))).toEqual([3])
    expect(showsExplicit(null)).toBe(false)
  })
})
