export const pageKey = 'page'

export const listStart = 'list'

export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function searchAtPage(search: string, page: number): string {
  const params = new URLSearchParams(search)
  if (page > 1) {
    params.set(pageKey, String(page))
  } else {
    params.delete(pageKey)
  }
  const kept = params.toString()
  return kept === '' ? '' : `?${kept}`
}
