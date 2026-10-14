import type { Context } from 'hono'
import { ImageResponse } from '@takumi-rs/image-response'
import { z } from 'zod'
import { config, OG_H, OG_W } from '@/config'
import type { Card } from '@/cards/load'
import { BackendError, NotFoundError } from '@/services/backend'
import { getCachedImage, setCachedImage, type CachedImage } from '@/services/image-cache'
import { getRenderer } from '@/services/renderer'
import { isETagMatch } from '@/utils/etag'

export const localeSchema = z.enum(['zh', 'en', 'ja']).catch('zh')

export const idSchema = z.coerce.number().int().positive()

const webp = 'image/webp'

const cachedHeaders = {
  'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const

const missingHeaders = { 'cache-control': 'public, max-age=300' } as const

const failedHeaders = { 'cache-control': 'no-store' } as const

const uncachedHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  pragma: 'no-cache',
  expires: '0',
} as const

export async function renderCard(card: Card): Promise<Buffer> {
  const response = new ImageResponse(card.element, {
    renderer: getRenderer(),
    width: OG_W,
    height: OG_H,
    format: 'webp',
    fetchedResources: card.pictures,
  })
  return Buffer.from(await response.arrayBuffer())
}

export async function serveOgImage(
  c: Context,
  opts: { type: string; id: string; locale: string; card: () => Promise<Card> },
): Promise<Response> {
  const { type, id, locale } = opts
  const caching = !config.OG_CACHE_DISABLED
  let entry: CachedImage | null = getCachedImage(type, id, locale)
  if (entry === null) {
    try {
      entry = setCachedImage(type, id, locale, await renderCard(await opts.card()))
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Not found' }, 404, caching ? missingHeaders : uncachedHeaders)
      }
      if (err instanceof BackendError) {
        return c.json({ error: err.message }, err.status >= 500 ? 502 : 400, failedHeaders)
      }
      console.error(`[og] render failed for ${type}/${id}:`, err)
      return c.json({ error: 'Render failed' }, 500, failedHeaders)
    }
  }
  if (!caching) {
    return new Response(entry.image, { headers: { ...uncachedHeaders, 'content-type': webp } })
  }
  const headers = { ...cachedHeaders, etag: entry.etag }
  if (isETagMatch(entry.etag, c.req.header('if-none-match') ?? null)) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(entry.image, { headers: { ...headers, 'content-type': webp } })
}
