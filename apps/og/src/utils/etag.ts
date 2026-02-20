import { config } from '@/config'

/**
 * Generates a weak ETag for an OG image.
 *
 * Correct HTTP format: W/"<hex>"
 * The old frontend implementation used "W/<hex>" (wrong — outer quotes must
 * only wrap the opaque value, the W/ prefix goes outside).
 *
 * Includes OG_DESIGN_VERSION so bumping the version invalidates all cached
 * ETags across CDN/browser when the visual design changes.
 */
export async function makeETag(type: string, id: string, locale: string): Promise<string> {
  const input = `${type}:${id}:${locale}:${config.OG_DESIGN_VERSION}`
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `W/"${hex}"`
}

export function isETagMatch(etag: string, ifNoneMatch: string | null): boolean {
  if (!ifNoneMatch) return false
  // Handle both single value and comma-separated list
  return ifNoneMatch.split(',').some(v => v.trim() === etag)
}
