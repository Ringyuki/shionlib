import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { PreferenceChange } from './viewer.schema'

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

export async function savePreferences(api: ApiClient, change: PreferenceChange) {
  if (change.lang !== undefined) {
    await api.post('/user/info/lang', { body: { lang: change.lang } })
  }
  if (change.contentLimit !== undefined) {
    await api.post('/user/info/content-limit', { body: { content_limit: change.contentLimit } })
  }
  if (change.onlyGamesWithResources !== undefined) {
    await api.post('/user/info/only-games-with-resources', {
      body: { only_games_with_resources: change.onlyGamesWithResources },
    })
  }
  if (change.showProfileBackgrounds !== undefined) {
    await api.post('/user/info/profile-backgrounds', {
      body: { show_profile_backgrounds: change.showProfileBackgrounds },
    })
  }
  return null
}
