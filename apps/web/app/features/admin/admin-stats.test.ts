import { describe, expect, it } from 'vitest'
import { spoolShare, spoolUsed } from './admin-stats'

describe('spool usage', () => {
  it('is what is no longer available', () => {
    expect(spoolUsed({ spool_capacity: 120, spool_available: 80 })).toBe(40)
    expect(spoolShare({ spool_capacity: 120, spool_available: 90 })).toBe(0.25)
  })

  it('stays within bounds when the numbers are off', () => {
    expect(spoolUsed({ spool_capacity: 10, spool_available: 20 })).toBe(0)
    expect(spoolShare({ spool_capacity: 0, spool_available: 0 })).toBe(0)
  })
})
