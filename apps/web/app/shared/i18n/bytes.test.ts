import { describe, expect, it } from 'vitest'
import { byteSize, shortFractionDigits } from './bytes'

describe('byteSize', () => {
  it('picks the largest unit below 1024', () => {
    expect(byteSize(4.12 * 1024 ** 3)).toMatchObject({ unit: 'GB' })
    expect(byteSize(512)).toEqual({ value: 512, unit: 'B' })
    expect(byteSize(-3)).toEqual({ value: 0, unit: 'B' })
  })
})

describe('shortFractionDigits', () => {
  it('keeps three significant digits for a size shown in a narrow column', () => {
    expect(shortFractionDigits(3.97)).toBe(2)
    expect(shortFractionDigits(87.94)).toBe(1)
    expect(shortFractionDigits(299.12)).toBe(0)
    expect(shortFractionDigits(1023.9)).toBe(0)
  })
})
