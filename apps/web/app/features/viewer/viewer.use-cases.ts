import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'

export async function loadViewer(api: ApiClient) {
  try {
    return await api.get('/user/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}
