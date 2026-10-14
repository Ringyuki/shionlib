import { createHash } from 'node:crypto'

export function etagOf(image: Buffer): string {
  return `W/"${createHash('sha256').update(image).digest('hex')}"`
}

export function isETagMatch(etag: string, ifNoneMatch: string | null): boolean {
  if (!ifNoneMatch) return false
  return ifNoneMatch.split(',').some(v => v.trim() === etag)
}
