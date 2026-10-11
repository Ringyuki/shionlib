import type { ApiClient } from '~/shared/api/client'
import type { NameChange } from './settings.schema'

export async function nameTaken(api: ApiClient, { name }: NameChange): Promise<boolean> {
  const check = await api.post('/user/check-name', { body: { name: name.trim() } })
  return check.exists
}

export function rename(api: ApiClient, { name }: NameChange) {
  return api.post('/user/info/name', { body: { name: name.trim() } })
}
