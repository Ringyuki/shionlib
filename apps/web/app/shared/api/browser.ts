import type { ApiPath, ApiQuery } from './types'

export const browserApiBase = '/api'

export function browserApiUrl<Path extends ApiPath<'get'>>(
  path: Path,
  query: ApiQuery<Path, 'get'>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value))
    }
  }
  const search = params.toString()
  return `${browserApiBase}${path}${search === '' ? '' : `?${search}`}`
}
