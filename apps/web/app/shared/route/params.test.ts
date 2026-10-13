import { describe, expect, it } from 'vitest'
import { idParam, pageParam } from './params'

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

describe('pageParam', () => {
  it('parses positive pages and falls back to the first', () => {
    expect(pageParam('3')).toBe(3)
    expect(pageParam('0')).toBe(1)
    expect(pageParam('x')).toBe(1)
    expect(pageParam(null)).toBe(1)
  })
})
