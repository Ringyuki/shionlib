import type { ApiClient } from '~/shared/api/client'
import { fileBody } from '~/shared/api/file-body'
import { uploadsPageSize, type Profile, type Uploads } from './profile'
import { removed, type ProfileEdit } from './profile.schema'

export function loadProfile(api: ApiClient, userId: number): Promise<Profile> {
  return api.get('/user/{id}', { params: { path: { id: userId } } })
}

export async function loadUploads(api: ApiClient, userId: number, page: number): Promise<Uploads> {
  const found = await api.get('/user/datas/{id}/game-resources', {
    params: { path: { id: userId }, query: { page, pageSize: uploadsPageSize } },
  })
  return {
    items: found.items ?? [],
    total: found.meta.totalItems,
    page,
    own: found.meta.is_current_user,
  }
}

export async function saveProfile(api: ApiClient, edit: ProfileEdit) {
  if (edit.bio !== undefined) {
    await api.post('/user/info/bio', { body: { bio: edit.bio.trim() } })
  }
  if (edit.avatar !== undefined) {
    await api.post('/user/info/avatar', fileBody('avatar', edit.avatar))
  }
  if (edit.cover === removed) {
    await api.delete('/user/info/cover')
  } else if (edit.cover !== undefined) {
    await api.post('/user/info/cover', fileBody('cover', edit.cover))
  }
  if (edit.background === removed) {
    await api.delete('/user/info/background')
  } else if (edit.background !== undefined) {
    await api.post('/user/info/background', fileBody('background', edit.background))
  }
  return null
}
