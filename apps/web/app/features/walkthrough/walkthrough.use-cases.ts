import type { ApiClient } from '~/shared/api/client'
import { bbcodeSource } from '~/shared/markup/lexical'
import { lexicalDocument } from '~/shared/markup/lexical-document'
import { lexicalRootFrom } from '~/shared/markup/lexical.schema'
import {
  pageSize,
  userPageSize,
  type Draft,
  type GameRef,
  type Reading,
  type UserWalkthroughs,
  type Walkthrough,
  type Walkthroughs,
} from './walkthrough'
import type { WalkthroughRemoval, WalkthroughSave } from './walkthrough.schema'

export async function loadWalkthroughs(
  api: ApiClient,
  gameId: number,
  page: number,
): Promise<Walkthroughs> {
  const found = await api.get('/walkthrough/game/{id}', {
    params: { path: { id: gameId }, query: { page, pageSize } },
  })
  return { gameId, items: found.items ?? [], total: found.meta.totalItems, page }
}

export async function countWalkthroughs(api: ApiClient, gameId: number): Promise<number> {
  const found = await api.get('/walkthrough/game/{id}', {
    params: { path: { id: gameId }, query: { page: 1, pageSize: 1 } },
  })
  return found.meta.totalItems
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

export async function loadReading(
  api: ApiClient,
  gameId: number,
  walkthroughId: number,
): Promise<Reading | undefined> {
  const [game, walkthrough] = await Promise.all([
    loadGame(api, gameId),
    written(api, walkthroughId),
  ])
  return walkthrough.game_id === gameId
    ? { game, walkthrough, source: sourceOf(walkthrough) }
    : undefined
}

export async function loadDraft(
  api: ApiClient,
  gameId: number,
  walkthroughId: number | undefined,
): Promise<Draft | undefined> {
  const game = await loadGame(api, gameId)
  if (walkthroughId === undefined) {
    return { game, walkthroughId, title: '', content: '', published: false }
  }
  const walkthrough = await written(api, walkthroughId)
  if (walkthrough.game_id !== gameId) {
    return undefined
  }
  return {
    game,
    walkthroughId,
    title: walkthrough.title,
    content: sourceOf(walkthrough),
    published: walkthrough.status !== 'DRAFT',
  }
}

export async function saveWalkthrough(api: ApiClient, save: WalkthroughSave): Promise<Walkthrough> {
  const body = {
    title: save.title.trim(),
    content: lexicalDocument(save.content),
    status: save.publish ? ('PUBLISHED' as const) : ('DRAFT' as const),
  }
  if (save.walkthroughId === undefined) {
    return api.post('/walkthrough', { body: { ...body, game_id: save.gameId } })
  }
  return api.patch('/walkthrough/{id}', { params: { path: { id: save.walkthroughId } }, body })
}

export async function removeWalkthrough(api: ApiClient, removal: WalkthroughRemoval) {
  await api.delete('/walkthrough/{id}', { params: { path: { id: removal.walkthroughId } } })
}

async function loadGame(api: ApiClient, gameId: number): Promise<GameRef> {
  const header = await api.get('/game/{id}/header', { params: { path: { id: gameId } } })
  return {
    id: header.id,
    title_jp: header.title_jp,
    title_zh: header.title_zh,
    title_en: header.title_en,
  }
}

function written(api: ApiClient, walkthroughId: number): Promise<Walkthrough> {
  return api.get('/walkthrough/{id}', {
    params: { path: { id: walkthroughId }, query: { withContent: 'true' } },
  })
}

function sourceOf(walkthrough: Pick<Walkthrough, 'content'>): string {
  const root = lexicalRootFrom(walkthrough.content)
  return root === undefined ? '' : bbcodeSource(root)
}
