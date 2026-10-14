import { describe, expect, it } from 'bun:test'
import { etagOf, isETagMatch } from '../../src/utils/etag'

describe('utils/etag', () => {
  it('follows the bytes of the image', () => {
    const tag = etagOf(Buffer.from([1, 2, 3]))
    expect(tag).toMatch(/^W\/"[0-9a-f]{64}"$/)
    expect(etagOf(Buffer.from([1, 2, 3]))).toBe(tag)
    expect(etagOf(Buffer.from([1, 2, 4]))).not.toBe(tag)
  })

  it('matches a tag alone or in a list', () => {
    const tag = etagOf(Buffer.from([1]))
    expect(isETagMatch(tag, null)).toBe(false)
    expect(isETagMatch(tag, tag)).toBe(true)
    expect(isETagMatch(tag, `"other", ${tag} , "more"`)).toBe(true)
    expect(isETagMatch(tag, 'W/"aabbccdd"')).toBe(false)
  })
})
