import type { ApiClient } from '~/shared/api/client'
import {
  listQuery,
  tagOptionSize,
  type LibraryAddress,
  type LibraryContent,
  type TagOption,
} from './library'

export async function loadLibrary(
  api: ApiClient,
  address: LibraryAddress,
  years: number[],
): Promise<LibraryContent> {
  const found = await api.get('/game/list', { params: { query: listQuery(address) } })
  return { address, games: found.items ?? [], total: found.meta.totalItems, years }
}

export async function searchTags(api: ApiClient, raw: string): Promise<TagOption[]> {
  const found = await api.get('/tags', {
    params: { query: { q: raw.trim(), limit: tagOptionSize } },
  })
  return (found ?? []).map(({ name, count }) => ({ name, count }))
}
