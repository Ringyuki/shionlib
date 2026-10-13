import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { pageSize, typeOf, type Category, type Inbox, type MessageDetail } from './message'

async function openMessage(api: ApiClient, id: number): Promise<MessageDetail | null> {
  try {
    return await api.get('/message/{id}', { params: { path: { id } } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

async function inbox(
  api: ApiClient,
  category: Category,
  page: number,
  openedId: number | undefined,
): Promise<Inbox> {
  const opened = openedId === undefined ? null : await openMessage(api, openedId)
  const [list, unread] = await Promise.all([
    api.get('/message/list', { params: { query: { page, pageSize, type: typeOf(category) } } }),
    api.get('/message/unread'),
  ])
  return { category, page, items: list.items ?? [], total: list.meta.totalItems, unread, opened }
}

export async function loadInbox(
  api: ApiClient,
  category: Category,
  page: number,
  openedId: number | undefined,
): Promise<Inbox | null> {
  try {
    return await inbox(api, category, page, openedId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export async function countUnread(api: ApiClient): Promise<number> {
  try {
    return await api.get('/message/unread')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return 0
    }
    throw error
  }
}

export async function markAllRead(api: ApiClient) {
  await api.post('/message/all/read')
  return null
}
