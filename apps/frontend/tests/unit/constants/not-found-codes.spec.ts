import { describe, expect, it } from 'vitest'
import { NOT_FOUND_CODES } from '../../../constants/not-found-codes'

describe('constants/not-found-codes (unit)', () => {
  it('contains deduplicated numeric not-found business codes', () => {
    expect(NOT_FOUND_CODES.length).toBeGreaterThan(0)
    expect(new Set(NOT_FOUND_CODES).size).toBe(NOT_FOUND_CODES.length)
    expect(NOT_FOUND_CODES.every(code => Number.isInteger(code) && code > 0)).toBe(true)
  })
})
