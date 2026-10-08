import type { ApiClient } from '~/shared/api/client'
import { uploadsPageSize, type Profile, type Uploads } from './profile'

export function loadProfile(api: ApiClient, userId: number): Promise<Profile> {
  return api.get('/user/{id}', { params: { path: { id: userId } } })
}

export async function loadUploads(api: ApiClient, userId: number, page: number): Promise<Uploads> {
  const found = await api.get('/user/datas/{id}/game-resources', {
    params: { path: { id: userId }, query: { page, pageSize: uploadsPageSize } },
  })
  return { items: found.items ?? [], total: found.meta.totalItems, page }
}
