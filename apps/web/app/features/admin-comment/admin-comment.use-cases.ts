import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  blocked,
  everyStatus,
  type AuthorFacts,
  type Comment,
  type Filter,
  type Opened,
} from './admin-comment'
import type { CommentChange } from './admin-comment.schema'

export type Listing = {
  filter: Filter
  comments: Comment[]
  total: number
  opened: Opened | undefined
}

async function loadAuthor(api: ApiClient, id: number): Promise<AuthorFacts> {
  const one = { page: 1, pageSize: 1, creatorId: id }
  const [user, written, hidden] = await Promise.all([
    api.get('/admin/users/{id}', { params: { path: { id } } }),
    api.get('/admin/comments', { params: { query: one } }),
    api.get('/admin/comments', { params: { query: { ...one, status: blocked } } }),
  ])
  return {
    joined: user.created,
    written: written.meta.totalItems,
    blocked: hidden.meta.totalItems,
  }
}

async function loadOpened(api: ApiClient, id: number): Promise<Opened | undefined> {
  try {
    const detail = await api.get('/admin/comments/{id}', { params: { path: { id } } })
    return { detail, author: await loadAuthor(api, detail.creator.id) }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadComments(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, opened] = await Promise.all([
    api.get('/admin/comments', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          sortBy: 'created',
          sortOrder: filter.sort === 'oldest' ? 'asc' : 'desc',
          ...(filter.status === everyStatus ? {} : { status: filter.status }),
          ...(filter.query === '' ? {} : { search: filter.query }),
          ...(filter.author === undefined ? {} : { creatorId: filter.author }),
        },
      },
    }),
    filter.opened === undefined ? undefined : loadOpened(api, filter.opened),
  ])
  return { filter, comments: page.items ?? [], total: page.meta.totalItems, opened }
}

export async function changeComments(api: ApiClient, change: CommentChange): Promise<null> {
  if (change.action === 'rescan') {
    await api.post('/admin/comments/{id}/rescan', { params: { path: { id: change.id } } })
    return null
  }
  const hides = change.status === blocked
  const reason = change.reason.trim()
  await Promise.all(
    change.ids.map(id =>
      api.patch('/admin/comments/{id}/status', {
        params: { path: { id } },
        body: {
          status: change.status,
          ...(hides ? { top_category: change.category, notify: change.notify } : {}),
          ...(hides && reason !== '' ? { reason } : {}),
        },
      }),
    ),
  )
  return null
}
