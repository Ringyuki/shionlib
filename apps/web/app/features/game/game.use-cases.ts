import type { ApiClient } from '~/shared/api/client'
import { worksPageSize, type GameHeader, type Works, type WorksOf } from './game'
import { orderQuery, type GameOrder } from './game-order'
import { bangumiScore, scoreSites, vndbScore, type Scores } from './game-score'

export async function loadGamePage(api: ApiClient, id: number) {
  const params = { params: { path: { id } } }
  const [header, details, characters] = await Promise.all([
    api.get('/game/{id}/header', params),
    api.get('/game/{id}/details', params),
    api.get('/game/{id}/characters', params),
  ])
  return { header, details, characters: characters.characters ?? [] }
}

export async function loadScores(
  api: ApiClient,
  game: Pick<GameHeader, 'id' | 'b_id' | 'v_id'>,
): Promise<Scores> {
  const params = { params: { path: { id: game.id } } }
  const sources = new Set(scoreSites(game).map(site => site.source))
  const [bangumi, vndb] = await Promise.allSettled([
    sources.has('bangumi')
      ? api.get('/game/score/bangumi/{id}', params).then(bangumiScore)
      : undefined,
    sources.has('vndb') ? api.get('/game/score/vndb/{id}', params).then(vndbScore) : undefined,
  ])
  return { bangumi: settled(bangumi), vndb: settled(vndb) }
}

function settled<Value>(result: PromiseSettledResult<Value | undefined>): Value | undefined {
  return result.status === 'fulfilled' ? result.value : undefined
}

export async function loadWorks(
  api: ApiClient,
  of: WorksOf,
  page: number,
  order: GameOrder,
): Promise<Works> {
  const found = await api.get('/game/list', {
    params: {
      query: {
        ...('developer' in of ? { developer_id: of.developer } : { character_id: of.character }),
        page,
        pageSize: worksPageSize,
        ...orderQuery(order),
      },
    },
  })
  return { games: found.items ?? [], total: found.meta.totalItems, page, order }
}

export async function countView(api: ApiClient, id: number) {
  await api.post('/game/{id}/view', { params: { path: { id } } })
}
