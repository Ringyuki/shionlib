import { describe, expect, it } from 'vitest'
import { percentSent } from './media'

describe('percentSent', () => {
  it('tells how much of a file has left, in whole percent', () => {
    expect(percentSent(0, 2000)).toBe(0)
    expect(percentSent(1240, 2000)).toBe(62)
    expect(percentSent(1259, 2000)).toBe(62)
  })

  it('stops short of the whole until the API has answered', () => {
    expect(percentSent(2000, 2000)).toBe(99)
    expect(percentSent(2400, 2000)).toBe(99)
  })

  it('says nothing was sent of a file without a size', () => {
    expect(percentSent(10, 0)).toBe(0)
  })
})
