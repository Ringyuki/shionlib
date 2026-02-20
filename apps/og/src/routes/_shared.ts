import type { Context } from 'hono'
import { z } from 'zod'
import { config } from '@/config'
import { makeETag, isETagMatch } from '@/utils/etag'
import { getCachedImage, setCachedImage } from '@/services/image-cache'
import { NotFoundError, BackendError } from '@/services/metadata'

export const localeSchema = z.enum(['en', 'zh', 'ja']).catch('zh' as const)

export const idSchema = z.string().regex(/^\d+$/, 'id must be a positive integer')

export const CONTENT_TYPE_WEBP = 'image/webp'

const CACHE_HEADERS_ENABLED = {
  'cache-control': 'public, max-age=604800, stale-while-revalidate=86400',
} as const

const CACHE_HEADERS_DISABLED = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  pragma: 'no-cache',
  expires: '0',
} as const

/**
 * Unified OG request handler.
 *
 * Flow: ETag check → Redis cache hit → render → cache write → respond
 */
export async function serveOgImage(
  c: Context,
  opts: {
    type: string
    id: string
    locale: string
    render: () => Promise<Buffer>
  },
): Promise<Response> {
  const { type, id, locale, render } = opts

  const cacheHeaders = config.OG_CACHE_DISABLED ? CACHE_HEADERS_DISABLED : CACHE_HEADERS_ENABLED
  const etag = await makeETag(type, id, locale)

  // 304 Not Modified
  if (!config.OG_CACHE_DISABLED && isETagMatch(etag, c.req.header('if-none-match') ?? null)) {
    return new Response(null, {
      status: 304,
      headers: { ...CACHE_HEADERS_ENABLED, etag },
    })
  }

  // Redis cache hit
  const cached = await getCachedImage(type, id, locale)
  if (cached) {
    return new Response(cached, {
      headers: {
        ...cacheHeaders,
        ...(config.OG_CACHE_DISABLED ? {} : { etag }),
        'content-type': CONTENT_TYPE_WEBP,
      },
    })
  }

  // Render
  let buffer: Buffer
  try {
    buffer = await render()
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Not found' }, 404)
    }
    if (err instanceof BackendError) {
      const status = err.status >= 500 ? 502 : err.status
      return c.json({ error: err.message }, status as 400 | 502)
    }
    console.error(`[og] render failed for ${type}/${id}:`, err)
    return c.json({ error: 'Render failed' }, 500)
  }

  // Write to cache async — do not block the response
  if (!config.OG_CACHE_DISABLED) {
    setCachedImage(type, id, locale, buffer).catch(err =>
      console.error('[og] cache write failed:', err),
    )
  }

  return new Response(buffer, {
    headers: {
      ...cacheHeaders,
      ...(config.OG_CACHE_DISABLED ? {} : { etag }),
      'content-type': CONTENT_TYPE_WEBP,
    },
  })
}
