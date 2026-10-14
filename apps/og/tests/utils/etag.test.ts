import { describe, expect, it } from 'bun:test'

process.env.OG_DESIGN_VERSION = '1'

const { makeETag, isETagMatch } = await import('../../src/utils/etag')

describe('utils/etag', () => {
  describe('makeETag', () => {
    it('returns correct weak ETag format  W/"<64-hex-chars>"', async () => {
      const tag = await makeETag('game', '42', 'en')
      expect(tag).toMatch(/^W\/"[0-9a-f]{64}"$/)
    })

    it('is deterministic for the same inputs', async () => {
      const a = await makeETag('game', '42', 'en')
      const b = await makeETag('game', '42', 'en')
      expect(a).toBe(b)
    })

    it('produces different values for different types', async () => {
      const a = await makeETag('game', '42', 'en')
      const b = await makeETag('character', '42', 'en')
      expect(a).not.toBe(b)
    })

    it('produces different values for different ids', async () => {
      const a = await makeETag('game', '1', 'en')
      const b = await makeETag('game', '2', 'en')
      expect(a).not.toBe(b)
    })

    it('produces different values for different locales', async () => {
      const a = await makeETag('game', '42', 'en')
      const b = await makeETag('game', '42', 'zh')
      expect(a).not.toBe(b)
    })

    it('changes with the design version', async () => {
      const { config } = await import('../../src/config')
      const before = await makeETag('game', '42', 'en')
      const kept = config.OG_DESIGN_VERSION
      config.OG_DESIGN_VERSION = `${kept}-next`
      const after = await makeETag('game', '42', 'en')
      config.OG_DESIGN_VERSION = kept
      expect(after).not.toBe(before)
    })
  })

  describe('isETagMatch', () => {
    it('returns false for null If-None-Match', async () => {
      const tag = await makeETag('game', '1', 'en')
      expect(isETagMatch(tag, null)).toBe(false)
    })

    it('returns true for exact match', async () => {
      const tag = await makeETag('game', '1', 'en')
      expect(isETagMatch(tag, tag)).toBe(true)
    })

    it('returns true when ETag appears in a comma-separated list', async () => {
      const tag = await makeETag('game', '1', 'en')
      expect(isETagMatch(tag, `"other-etag", ${tag}, "yet-another"`)).toBe(true)
    })

    it('returns false when ETag is absent from the list', async () => {
      const tag = await makeETag('game', '1', 'en')
      expect(isETagMatch(tag, 'W/"aabbccdd"')).toBe(false)
    })

    it('handles whitespace around values in the list', async () => {
      const tag = await makeETag('game', '5', 'ja')
      expect(isETagMatch(tag, `   ${tag}   `)).toBe(true)
    })
  })
})
