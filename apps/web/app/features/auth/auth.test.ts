import { describe, expect, it } from 'vitest'
import { remainingSeconds } from './auth'

describe('remainingSeconds', () => {
  it('counts down from the last request', () => {
    expect(remainingSeconds(undefined, 1000)).toBe(0)
    expect(remainingSeconds(0, 15_500)).toBe(45)
    expect(remainingSeconds(0, 61_000)).toBe(0)
  })
})
