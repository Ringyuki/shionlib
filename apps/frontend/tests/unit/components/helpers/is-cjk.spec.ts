import { describe, expect, it } from 'vitest'
import { isCJK } from '../../../../components/common/user/helpers/is-cjk'

describe('components/common/user/helpers/is-cjk (unit)', () => {
  it('detects cjk text and rejects non-cjk text', () => {
    expect(isCJK('你好')).toBe(true)
    expect(isCJK('こんにちは')).toBe(true)
    expect(isCJK('한글')).toBe(true)
    expect(isCJK('hello')).toBe(false)
    expect(isCJK('')).toBe(false)
  })
})
