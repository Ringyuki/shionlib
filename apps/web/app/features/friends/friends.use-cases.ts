import type { ApiClient } from '~/shared/api/client'
import type { Friend } from './friends'

export async function loadFriends(api: ApiClient): Promise<Friend[]> {
  return (await api.get('/friend-links')) ?? []
}
