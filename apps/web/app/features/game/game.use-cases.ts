import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { bangumiScore, vndbScore, type GameHeader, type Scores } from './game'

export async function loadGamePage(api: ApiClient, id: number) {
  const params = { params: { path: { id } } }
  const [header, details, characters] = await Promise.all([
    api.get('/game/{id}/header', params),
    api.get('/game/{id}/details', params),
    api.get('/game/{id}/characters', params),
  ])
  return { header, details, characters: characters.characters ?? [] }
}

async function optional<Value>(request: Promise<Value>): Promise<Value | undefined> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError) {
      return undefined
    }
    throw error
  }
}

export async function loadScores(
  api: ApiClient,
  game: Pick<GameHeader, 'id' | 'b_id' | 'v_id'>,
): Promise<Scores> {
  const params = { params: { path: { id: game.id } } }
  const [bangumi, vndb] = await Promise.all([
    game.b_id === null ? undefined : optional(api.get('/game/score/bangumi/{id}', params)),
    game.v_id === null ? undefined : optional(api.get('/game/score/vndb/{id}', params)),
  ])
  return {
    bangumi:
      bangumi === undefined || game.b_id === null ? undefined : bangumiScore(bangumi, game.b_id),
    vndb: vndb === undefined || game.v_id === null ? undefined : vndbScore(vndb, game.v_id),
  }
}

export async function countView(api: ApiClient, id: number) {
  await api.post('/game/{id}/view', { params: { path: { id } } })
}

export async function loadLatestGames(api: ApiClient, pageSize: number) {
  const page = await api.get('/game/list', { params: { query: { pageSize } } })
  return page.items ?? []
}
