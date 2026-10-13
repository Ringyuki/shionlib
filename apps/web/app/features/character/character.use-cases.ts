import { firstOrder, loadWorks } from '~/features/game'
import type { ApiClient } from '~/shared/api/client'
import type { CharacterContent } from './character'

export async function loadCharacter(
  api: ApiClient,
  id: number,
  page: number,
): Promise<CharacterContent> {
  const [character, works] = await Promise.all([
    api.get('/character/{id}', { params: { path: { id } } }),
    loadWorks(api, { character: id }, page, firstOrder),
  ])
  return { character, works }
}
