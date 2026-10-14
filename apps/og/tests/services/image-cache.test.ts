import { beforeEach, describe, expect, it } from 'bun:test'

process.env.BACKEND_INTERNAL_URL = 'http://test-backend:5000'
process.env.OG_CACHE_DISABLED = 'false'

const { getCachedImage, setCachedImage, invalidateCache } =
  await import('../../src/services/image-cache')
const { config, IMAGE_CACHE_MAX, IMAGE_CACHE_TTL_MS, LOCALES } = await import('../../src/config')
const { etagOf } = await import('../../src/utils/etag')

const buf = (n: number): Buffer => Buffer.from([n & 0xff])
const now = 1_000_000

function fill(count: number, offset = 0): void {
  for (let i = 0; i < count; i++) setCachedImage('game', String(offset + i), 'zh', buf(i), now)
}

describe('image cache', () => {
  beforeEach(() => {
    config.OG_CACHE_DISABLED = false
    for (let i = 0; i < IMAGE_CACHE_MAX * 2; i++) invalidateCache('game', String(i))
  })

  it('keeps an image with the tag of its bytes, per type, id and locale', () => {
    expect(getCachedImage('game', '1', 'zh', now)).toBeNull()
    const entry = setCachedImage('game', '1', 'zh', buf(7), now)
    expect(entry.etag).toBe(etagOf(buf(7)))
    expect(getCachedImage('game', '1', 'zh', now)?.image).toEqual(buf(7))
    expect(getCachedImage('game', '1', 'en', now)).toBeNull()
    expect(getCachedImage('character', '1', 'zh', now)).toBeNull()
  })

  it('forgets an image once it is an hour old, so changed data is drawn again', () => {
    setCachedImage('game', '1', 'zh', buf(1), now)
    expect(getCachedImage('game', '1', 'zh', now + IMAGE_CACHE_TTL_MS - 1)).not.toBeNull()
    expect(getCachedImage('game', '1', 'zh', now + IMAGE_CACHE_TTL_MS)).toBeNull()
    expect(getCachedImage('game', '1', 'zh', now)).toBeNull()
  })

  it('evicts the least recently read entry past IMAGE_CACHE_MAX', () => {
    fill(IMAGE_CACHE_MAX)
    getCachedImage('game', '0', 'zh', now)
    setCachedImage('game', String(IMAGE_CACHE_MAX), 'zh', buf(0), now)
    expect(getCachedImage('game', '0', 'zh', now)).not.toBeNull()
    expect(getCachedImage('game', '1', 'zh', now)).toBeNull()
    let held = 0
    for (let i = 0; i <= IMAGE_CACHE_MAX; i++) {
      if (getCachedImage('game', String(i), 'zh', now) !== null) held++
    }
    expect(held).toBe(IMAGE_CACHE_MAX)
  })

  it('invalidateCache drops every locale for an id', () => {
    for (const locale of LOCALES) setCachedImage('game', '1', locale, buf(1), now)
    invalidateCache('game', '1')
    for (const locale of LOCALES) expect(getCachedImage('game', '1', locale, now)).toBeNull()
  })

  it('still tags but neither keeps nor reads while OG_CACHE_DISABLED', () => {
    config.OG_CACHE_DISABLED = true
    expect(setCachedImage('game', '2', 'zh', buf(2), now).etag).toBe(etagOf(buf(2)))
    config.OG_CACHE_DISABLED = false
    expect(getCachedImage('game', '2', 'zh', now)).toBeNull()
  })
})
