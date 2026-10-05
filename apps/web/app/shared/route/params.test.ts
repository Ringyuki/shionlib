import { describe, expect, it } from 'vitest'
import { idParam } from './params'

describe('idParam', () => {
  it('accepts positive integer ids', () => {
    expect(idParam('42')).toBe(42)
  })

  it('answers 404 for anything else', () => {
    for (const value of [undefined, '', '0', '-1', '1.5', 'abc', '9007199254740993']) {
      expect(() => idParam(value)).toThrow()
    }
  })
})
