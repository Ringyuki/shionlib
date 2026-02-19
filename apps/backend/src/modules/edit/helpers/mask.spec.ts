import { hasBit, mask, maskOf } from './mask'

describe('mask helpers', () => {
  it('builds bitmask values and checks bit existence', () => {
    const m = mask(0, 2, 5)

    expect(m).toBe(37n)
    expect(hasBit(m, 0)).toBe(true)
    expect(hasBit(m, 2)).toBe(true)
    expect(hasBit(m, 1)).toBe(false)
  })

  it('maskOf behaves the same as mask and handles empty input', () => {
    expect(maskOf(1, 3)).toBe(mask(1, 3))
    expect(mask()).toBe(0n)
    expect(maskOf()).toBe(0n)
  })
})
