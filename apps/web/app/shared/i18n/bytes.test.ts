import { describe, expect, it } from 'vitest'
import { byteSize } from './bytes'

describe('byteSize', () => {
  it('picks the largest unit below 1024', () => {
    expect(byteSize(4.12 * 1024 ** 3)).toMatchObject({ unit: 'GB' })
    expect(byteSize(512)).toEqual({ value: 512, unit: 'B' })
    expect(byteSize(-3)).toEqual({ value: 0, unit: 'B' })
  })
})
