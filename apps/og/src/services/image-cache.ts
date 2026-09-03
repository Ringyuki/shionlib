import { config, IMAGE_CACHE_MAX, SUPPORTED_LOCALES } from '@/config'

/**
 * Count-bounded LRU. Reading re-inserts the entry so it moves to the tail,
 * which keeps the least recently used entry as the first key.
 */
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

const cache = new Lru<Buffer>(IMAGE_CACHE_MAX)

function toKey(type: string, id: string, locale: string): string {
  return `${type}:${id}:${locale}`
}

export function getCachedImage(type: string, id: string, locale: string): Buffer | null {
  if (config.OG_CACHE_DISABLED) return null
  return cache.get(toKey(type, id, locale)) ?? null
}

export function setCachedImage(type: string, id: string, locale: string, buffer: Buffer): void {
  if (config.OG_CACHE_DISABLED) return
  cache.set(toKey(type, id, locale), buffer)
}

export function invalidateCache(type: string, id: string): void {
  for (const locale of SUPPORTED_LOCALES) {
    cache.delete(toKey(type, id, locale))
  }
}
