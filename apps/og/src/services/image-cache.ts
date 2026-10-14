import { config, IMAGE_CACHE_MAX, IMAGE_CACHE_TTL_MS, LOCALES } from '@/config'
import { etagOf } from '@/utils/etag'

export type CachedImage = { image: Buffer; etag: string; at: number }

class Lru<V> extends Map<string, V> {
  constructor(private readonly max: number) {
    super()
  }

  override get(key: string): V | undefined {
    const value = super.get(key)
    if (value !== undefined) {
      super.delete(key)
      super.set(key, value)
    }
    return value
  }

  override set(key: string, value: V): this {
    if (super.has(key)) super.delete(key)
    super.set(key, value)
    if (this.size > this.max) {
      const oldest = super.keys().next().value
      if (oldest !== undefined) super.delete(oldest)
    }
    return this
  }
}

const cache = new Lru<CachedImage>(IMAGE_CACHE_MAX)

function toKey(type: string, id: string, locale: string): string {
  return `${type}:${id}:${locale}`
}

export function getCachedImage(
  type: string,
  id: string,
  locale: string,
  now = Date.now(),
): CachedImage | null {
  if (config.OG_CACHE_DISABLED) return null
  const key = toKey(type, id, locale)
  const entry = cache.get(key)
  if (entry === undefined) return null
  if (now - entry.at >= IMAGE_CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry
}

export function setCachedImage(
  type: string,
  id: string,
  locale: string,
  image: Buffer,
  now = Date.now(),
): CachedImage {
  const entry = { image, etag: etagOf(image), at: now }
  if (!config.OG_CACHE_DISABLED) cache.set(toKey(type, id, locale), entry)
  return entry
}

export function invalidateCache(type: string, id: string): void {
  for (const locale of LOCALES) {
    cache.delete(toKey(type, id, locale))
  }
}
