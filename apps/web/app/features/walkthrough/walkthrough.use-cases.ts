import type { ApiClient } from '~/shared/api/client'
import type { ApiBody, Schema } from '~/shared/api/types'
import {
  stateOf,
  userPageSize,
  writtenBy,
  type Credit,
  type Guides,
  type UserWalkthroughs,
  type Walkthrough,
  type WalkthroughState,
} from './walkthrough'
import type { WalkthroughRemoval, WalkthroughSave } from './walkthrough.schema'
import type { Step } from './walkthrough-steps'

type Sent = ApiBody<'/walkthrough/game/{id}/mine', 'put'>

type SentRoute = NonNullable<Sent['routes']>[number]

type SentStep = NonNullable<SentRoute['steps']>[number]

export type GameRef = Pick<Schema<'GameHeaderDTO'>, 'id' | 'title_jp' | 'title_zh' | 'title_en'>

export type Writing = { game: GameRef; credits: Credit[]; stored: Walkthrough | undefined }

export type Saved = { id: number; state: WalkthroughState }

export async function loadGuides(
  api: ApiClient,
  gameId: number,
  walkthroughId: number | undefined,
): Promise<Guides | undefined> {
  const [listed, named] = await Promise.all([
    api.get('/walkthrough/game/{id}', { params: { path: { id: gameId } } }),
    walkthroughId === undefined ? undefined : written(api, walkthroughId),
  ])
  const summaries = listed ?? []
  const first = summaries[0]
  const shown = named ?? (first === undefined ? undefined : await written(api, first.id))
  if (shown !== undefined && shown.game_id !== gameId) {
    return undefined
  }
  return { gameId, summaries, shown }
}

export async function loadUserWalkthroughs(
  api: ApiClient,
  userId: number,
  page: number,
): Promise<UserWalkthroughs> {
  const found = await api.get('/user/datas/{id}/walkthroughs', {
    params: { path: { id: userId }, query: { page, pageSize: userPageSize } },
  })
  return { items: found.items ?? [], total: found.meta.totalItems, page }
}

export async function loadWriting(
  api: ApiClient,
  gameId: number,
  writerId: number | undefined,
): Promise<Writing> {
  const path = { params: { path: { id: gameId } } }
  const [header, cast, listed] = await Promise.all([
    api.get('/game/{id}/header', path),
    api.get('/game/{id}/characters', path),
    writerId === undefined ? undefined : api.get('/walkthrough/game/{id}', path),
  ])
  const own = writtenBy(listed ?? [], writerId)
  return {
    game: {
      id: header.id,
      title_jp: header.title_jp,
      title_zh: header.title_zh,
      title_en: header.title_en,
    },
    credits: cast.characters ?? [],
    stored: own === undefined ? undefined : await written(api, own.id),
  }
}

export async function saveWalkthrough(api: ApiClient, save: WalkthroughSave): Promise<Saved> {
  const saved = await api.put('/walkthrough/game/{id}/mine', {
    params: { path: { id: save.gameId } },
    body: {
      ...(save.note === undefined ? {} : { note: save.note }),
      routes: save.routes.map(sentRoute),
      status: save.publish ? 'PUBLISHED' : 'DRAFT',
    },
  })
  return { id: saved.id, state: stateOf(saved) }
}

export async function removeWalkthrough(api: ApiClient, removal: WalkthroughRemoval) {
  await api.delete('/walkthrough/{id}', { params: { path: { id: removal.walkthroughId } } })
}

function written(api: ApiClient, walkthroughId: number): Promise<Walkthrough> {
  return api.get('/walkthrough/{id}', { params: { path: { id: walkthroughId } } })
}

function sentRoute(route: WalkthroughSave['routes'][number]): SentRoute {
  return {
    key: route.key,
    name: route.name,
    characters: route.characters,
    requires: route.requires,
    condition: route.condition,
    ending: route.ending,
    steps: route.steps.map(sentStep),
  }
}

function sentStep(step: Step): SentStep {
  switch (step.kind) {
    case 'choice':
      return step.remark === ''
        ? { kind: step.kind, text: step.text }
        : { kind: step.kind, text: step.text, remark: step.remark }
    case 'note':
      return { kind: step.kind, text: step.text }
    case 'save':
    case 'load':
      return { kind: step.kind, slot: step.slot }
    case 'gap':
      return { kind: step.kind }
  }
}
