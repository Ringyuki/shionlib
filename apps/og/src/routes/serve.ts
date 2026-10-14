import type { Context } from 'hono'
import { ImageResponse } from '@takumi-rs/image-response'
import { z } from 'zod'
import { config, OG_H, OG_W } from '@/config'
import type { Card } from '@/cards/load'
import { BackendError, NotFoundError } from '@/services/backend'
import { getCachedImage, setCachedImage } from '@/services/image-cache'
import { getRenderer } from '@/services/renderer'
import { isETagMatch, makeETag } from '@/utils/etag'

export const localeSchema = z.enum(['zh', 'en', 'ja']).catch('zh')

export const idSchema = z.coerce.number().int().positive()

const webp = 'image/webp'

const cachedHeaders = {
  'cache-control': 'public, max-age=604800, stale-while-revalidate=86400',
} as const

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
  const etag = await makeETag(type, id, locale)
  const headers = caching ? { ...cachedHeaders, etag } : uncachedHeaders
  if (caching && isETagMatch(etag, c.req.header('if-none-match') ?? null)) {
    return new Response(null, { status: 304, headers })
  }
  const cached = getCachedImage(type, id, locale)
  if (cached) {
    return new Response(cached, { headers: { ...headers, 'content-type': webp } })
  }
  let buffer: Buffer
  try {
    buffer = await renderCard(await opts.card())
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Not found' }, 404)
    }
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, err.status >= 500 ? 502 : 400)
    }
    console.error(`[og] render failed for ${type}/${id}:`, err)
    return c.json({ error: 'Render failed' }, 500)
  }
  setCachedImage(type, id, locale, buffer)
  return new Response(buffer, { headers: { ...headers, 'content-type': webp } })
}
