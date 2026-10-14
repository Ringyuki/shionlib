import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { isLocale } from '~/shared/i18n/locale.schema'
import { placementsOf, type Placements, type Slot, type View } from './ad'

export async function loadPlacements(
  api: ApiClient,
  lang: string | undefined,
  wanted: Slot[],
): Promise<Placements> {
  try {
    const placed = await api.get('/ad/slots', {
      params: { query: { slot: wanted, ...(isLocale(lang) ? { locale: lang } : {}) } },
    })
    return placementsOf(placed ?? [])
  } catch (error) {
    if (error instanceof ApiError) {
      return {}
    }
    throw error
  }
}

export async function recordViews(api: ApiClient, views: View[]): Promise<null> {
  await api.post('/ad/views', { body: { views } })
  return null
}

export async function clickThrough(api: ApiClient, id: number, slot: Slot): Promise<string> {
  const { link } = await api.post('/ad/{id}/click', {
    params: { path: { id } },
    body: { slot },
  })
  return link
}
