import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { DocAuthor } from './docs'

async function loadAuthor(api: ApiClient, id: number): Promise<DocAuthor | undefined> {
  try {
    const { name, avatar } = await api.get('/user/{id}', { params: { path: { id } } })
    return { id, name, avatar }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadAuthors(api: ApiClient, ids: readonly number[]): Promise<DocAuthor[]> {
  const authors = await Promise.all(ids.map(id => loadAuthor(api, id)))
  return authors.filter(author => author !== undefined)
}
