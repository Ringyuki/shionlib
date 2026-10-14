import type { ApiClient } from '~/shared/api/client'
import {
  ascending,
  sessionsShown,
  type Filter,
  type Opened,
  type Records,
  type UserItem,
} from './admin-user'
import type { UserChange } from './admin-user.schema'

export type Listing = {
  filter: Filter
  users: UserItem[]
  total: number
}

export async function loadUsers(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const page = await api.get('/admin/users', {
    params: {
      query: {
        page: filter.page,
        pageSize,
        sortBy: filter.sort,
        sortOrder: ascending(filter.sort) ? 'asc' : 'desc',
        ...(filter.query === '' ? {} : { search: filter.query }),
        ...(filter.role === undefined ? {} : { role: filter.role }),
        ...(filter.status === undefined ? {} : { status: filter.status }),
      },
    },
  })
  return { filter, users: page.items ?? [], total: page.meta.totalItems }
}

async function loadRecords(api: ApiClient, id: number): Promise<Records> {
  const one = { page: 1, pageSize: 1 }
  const [filed, against, held, keys] = await Promise.all([
    api.get('/admin/content/download-resource-reports', {
      params: { query: { ...one, reporter_id: id } },
    }),
    api.get('/admin/content/download-resource-reports', {
      params: { query: { ...one, reported_user_id: id } },
    }),
    api.get('/admin/content/malware-scan-cases', {
      params: { query: { ...one, uploader_id: id, status: 'PENDING' } },
    }),
    api.get('/admin/open/keys', { params: { query: { page: 1, pageSize: 50, user: id } } }),
  ])
  return {
    reportsFiled: filed.meta.totalItems,
    reportsAgainst: against.meta.totalItems,
    heldFiles: held.meta.totalItems,
    apiKeys: keys.meta.totalItems,
    apiRequests: (keys.items ?? []).reduce((sum, key) => sum + key.recent.requests, 0),
  }
}

export async function loadUser(api: ApiClient, id: number): Promise<Opened> {
  const path = { id }
  const [detail, sessions, ladder, records] = await Promise.all([
    api.get('/admin/users/{id}', { params: { path } }),
    api.get('/admin/users/{id}/sessions', {
      params: { path, query: { page: 1, pageSize: sessionsShown, live: true } },
    }),
    api.get('/admin/upload-tiers'),
    loadRecords(api, id),
  ])
  return {
    detail,
    sessions: sessions.items ?? [],
    liveSessions: sessions.meta.totalItems,
    ladder,
    records,
  }
}

export async function changeUser(api: ApiClient, change: UserChange): Promise<null> {
  const params = { path: { id: change.id } }
  switch (change.action) {
    case 'profile':
      await api.patch('/admin/users/{id}/profile', {
        params,
        body: {
          name: change.name.trim(),
          email: change.email.trim(),
          lang: change.language,
          content_limit: change.contentLimit,
        },
      })
      return null
    case 'ban':
      await api.post('/admin/users/{id}/ban', {
        params,
        body: {
          banned_reason: change.reason.trim(),
          delete_user_comments: change.removeComments,
          ...(change.days === null
            ? { is_permanent: true }
            : { is_permanent: false, banned_duration_days: change.days }),
        },
      })
      return null
    case 'unban':
      await api.post('/admin/users/{id}/unban', { params })
      return null
    case 'password':
      await api.post('/admin/users/{id}/reset-password', {
        params,
        body: { password: change.password },
      })
      return null
    case 'logout':
      await api.post('/admin/users/{id}/force-logout', { params })
      return null
    case 'trust':
      await api.patch('/admin/users/{id}/upload-trust', {
        params,
        body: { trusted: change.trusted },
      })
      return null
    case 'role':
      await api.patch('/admin/users/{id}/role', { params, body: { role: change.role } })
      return null
    case 'badge':
      await api.patch('/admin/users/{id}/sponsor', {
        params,
        body: { sponsor_expires_at: change.until },
      })
      return null
  }
}
