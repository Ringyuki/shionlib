import { config, CACHE_TTL } from '@/config'
import { getRedis } from './redis'

const PREFIX = 'og:'

function toKey(type: string, id: string, locale: string): string {
  return `${PREFIX}${type}:${id}:${locale}`
}

export async function getCachedImage(
  type: string,
  id: string,
  locale: string,
): Promise<Buffer | null> {
  if (config.OG_CACHE_DISABLED) return null
  try {
    return await getRedis().getBuffer(toKey(type, id, locale))
  } catch {
    return null
  }
}

export async function setCachedImage(
  type: string,
  id: string,
  locale: string,
  buffer: Buffer,
): Promise<void> {
  if (config.OG_CACHE_DISABLED) return
  try {
    await getRedis().setex(toKey(type, id, locale), CACHE_TTL, buffer)
  } catch (err) {
    console.error('[image-cache] set failed:', err)
  }
}

export async function invalidateCache(type: string, id: string): Promise<void> {
  if (config.OG_CACHE_DISABLED) return
  try {
    const redis = getRedis()
    const keys = await redis.keys(`${PREFIX}${type}:${id}:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (err) {
    console.error('[image-cache] invalidate failed:', err)
  }
}
