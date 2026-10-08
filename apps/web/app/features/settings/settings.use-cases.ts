import type { ApiClient } from '~/shared/api/client'
import { fileBody } from '~/shared/api/file-body'
import type { BioChange, NameChange } from './settings.schema'

export function uploadAvatar(api: ApiClient, file: File) {
  return api.post('/user/info/avatar', fileBody('avatar', file))
}

export function uploadCover(api: ApiClient, file: File) {
  return api.post('/user/info/cover', fileBody('cover', file))
}

export async function nameTaken(api: ApiClient, { name }: NameChange): Promise<boolean> {
  const check = await api.post('/user/check-name', { body: { name: name.trim() } })
  return check.exists
}

export function rename(api: ApiClient, { name }: NameChange) {
  return api.post('/user/info/name', { body: { name: name.trim() } })
}

export function saveBio(api: ApiClient, { bio }: BioChange) {
  return api.post('/user/info/bio', { body: { bio: bio.trim() } })
}
