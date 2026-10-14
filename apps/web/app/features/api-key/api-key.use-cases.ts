import type { ApiClient } from '~/shared/api/client'
import type { Issued, Keys } from './api-key'
import type { KeyChange } from './api-key.schema'

export async function loadKeys(api: ApiClient): Promise<Keys> {
  return api.get('/user/api-keys')
}

export async function changeKey(api: ApiClient, change: KeyChange): Promise<Issued | null> {
  if (change.action === 'create') {
    return api.post('/user/api-keys', { body: { name: change.name } })
  }
  await api.delete('/user/api-keys/{id}', { params: { path: { id: change.id } } })
  return null
}
