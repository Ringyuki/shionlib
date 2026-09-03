import { describe, expect, it, beforeEach } from 'bun:test'

// Must be set before config module is imported
process.env.BACKEND_INTERNAL_URL = 'http://test-backend:5000'
process.env.OG_CACHE_DISABLED = 'false'

const { getCachedImage, setCachedImage, invalidateCache } =
  await import('../../src/services/image-cache')
const { config, IMAGE_CACHE_MAX, SUPPORTED_LOCALES } = await import('../../src/config')

const buf = (n: number): Buffer => Buffer.from([n & 0xff])

function fill(count: number, offset = 0): void {
  for (let i = 0; i < count; i++) setCachedImage('game', String(offset + i), 'zh', buf(i))
}

describe('image cache', () => {
  beforeEach(() => {
    config.OG_CACHE_DISABLED = false
    // The cache is a module singleton — drop everything the previous test left.
    for (let i = 0; i < IMAGE_CACHE_MAX * 2; i++) invalidateCache('game', String(i))
  })

  it('returns null for a key that was never written', () => {
    expect(getCachedImage('game', '1', 'zh')).toBeNull()
  })

  it('round-trips a buffer', () => {
    setCachedImage('game', '1', 'zh', buf(7))
    expect(getCachedImage('game', '1', 'zh')).toEqual(buf(7))
  })

  it('keys separately per type, id and locale', () => {
    setCachedImage('game', '1', 'zh', buf(1))
    expect(getCachedImage('game', '1', 'en')).toBeNull()
    expect(getCachedImage('character', '1', 'zh')).toBeNull()
  })

  it('evicts the oldest entry once past IMAGE_CACHE_MAX', () => {
    // No read in between — reading '0' here would refresh it and evict '1'.
    fill(IMAGE_CACHE_MAX)
    setCachedImage('game', String(IMAGE_CACHE_MAX), 'zh', buf(0))

    expect(getCachedImage('game', '0', 'zh')).toBeNull()
    expect(getCachedImage('game', '1', 'zh')).not.toBeNull()
    expect(getCachedImage('game', String(IMAGE_CACHE_MAX), 'zh')).not.toBeNull()
  })

  it('never grows past IMAGE_CACHE_MAX entries', () => {
    fill(IMAGE_CACHE_MAX * 2)

    let held = 0
    for (let i = 0; i < IMAGE_CACHE_MAX * 2; i++) {
      if (getCachedImage('game', String(i), 'zh') !== null) held++
    }
    expect(held).toBe(IMAGE_CACHE_MAX)
  })

  it('reading an entry protects it from the next eviction', () => {
    fill(IMAGE_CACHE_MAX)

    // '0' is the oldest, but reading it moves it to the tail so '1' goes first.
    getCachedImage('game', '0', 'zh')
    setCachedImage('game', String(IMAGE_CACHE_MAX), 'zh', buf(0))

    expect(getCachedImage('game', '0', 'zh')).not.toBeNull()
    expect(getCachedImage('game', '1', 'zh')).toBeNull()
  })

  it('invalidateCache drops every locale for an id', () => {
    for (const locale of SUPPORTED_LOCALES) setCachedImage('game', '1', locale, buf(1))

    invalidateCache('game', '1')

    for (const locale of SUPPORTED_LOCALES) {
      expect(getCachedImage('game', '1', locale)).toBeNull()
    }
  })

  it('neither reads nor writes while OG_CACHE_DISABLED', () => {
    setCachedImage('game', '1', 'zh', buf(1))
    config.OG_CACHE_DISABLED = true

    expect(getCachedImage('game', '1', 'zh')).toBeNull()

    setCachedImage('game', '2', 'zh', buf(2))
    config.OG_CACHE_DISABLED = false
    expect(getCachedImage('game', '2', 'zh')).toBeNull()
  })
})
