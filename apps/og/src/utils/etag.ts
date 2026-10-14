import { config } from '@/config'

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
  return ifNoneMatch.split(',').some(v => v.trim() === etag)
}
