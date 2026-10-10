import { loadGameResources } from '~/features/resource'
import type { ApiClient } from '~/shared/api/client'
import { blankDocument } from '~/shared/richtext/rich-text'
import {
  othersShown,
  pageSize,
  stateOf,
  statusOf,
  userPageSize,
  type Draft,
  type GameRef,
  type Reading,
  type Saved,
  type Shelf,
  type UserWalkthroughs,
  type Walkthrough,
  type WalkthroughItem,
  type Walkthroughs,
} from './walkthrough'
import type { WalkthroughPublish, WalkthroughRemoval, WalkthroughSave } from './walkthrough.schema'

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
  shelf: Shelf,
): Promise<UserWalkthroughs> {
  const status = statusOf(shelf)
  const found = await api.get('/user/datas/{id}/walkthroughs', {
    params: {
      path: { id: userId },
      query: { page, pageSize: userPageSize, ...(status === undefined ? {} : { status }) },
    },
  })
  return { items: found.items ?? [], total: found.meta.totalItems, page, shelf }
}

export async function loadReading(
  api: ApiClient,
  gameId: number,
  walkthroughId: number,
): Promise<Reading | undefined> {
  const [game, walkthrough, others, resources] = await Promise.all([
    loadGame(api, gameId),
    written(api, walkthroughId),
    published(api, gameId),
    loadGameResources(api, gameId),
  ])
  if (walkthrough.game_id !== gameId) {
    return undefined
  }
  return {
    game,
    resources: resources.length,
    walkthrough,
    content: walkthrough.content ?? blankDocument,
    others: others.filter(other => other.id !== walkthroughId).slice(0, othersShown),
  }
}

export async function loadDraft(
  api: ApiClient,
  gameId: number,
  walkthroughId: number | undefined,
): Promise<Draft | undefined> {
  const game = await loadGame(api, gameId)
  if (walkthroughId === undefined) {
    return {
      game,
      walkthroughId,
      authorId: undefined,
      title: '',
      content: blankDocument,
      state: 'draft',
    }
  }
  const walkthrough = await written(api, walkthroughId)
  if (walkthrough.game_id !== gameId) {
    return undefined
  }
  return {
    game,
    walkthroughId,
    authorId: walkthrough.creator.id,
    title: walkthrough.title,
    content: walkthrough.content ?? blankDocument,
    state: stateOf(walkthrough),
  }
}

export async function saveWalkthrough(api: ApiClient, save: WalkthroughSave): Promise<Saved> {
  const body = {
    title: save.title.trim(),
    content: save.content,
    status: save.publish ? ('PUBLISHED' as const) : ('DRAFT' as const),
  }
  const saved =
    save.walkthroughId === undefined
      ? await api.post('/walkthrough', { body: { ...body, game_id: save.gameId } })
      : await api.patch('/walkthrough/{id}', {
          params: { path: { id: save.walkthroughId } },
          body,
        })
  return { id: saved.id, state: stateOf(saved) }
}

export async function publishWalkthrough(
  api: ApiClient,
  publish: WalkthroughPublish,
): Promise<Saved> {
  const draft = await written(api, publish.walkthroughId)
  const saved = await api.patch('/walkthrough/{id}', {
    params: { path: { id: publish.walkthroughId } },
    body: { title: draft.title, content: draft.content ?? blankDocument, status: 'PUBLISHED' },
  })
  return { id: saved.id, state: stateOf(saved) }
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
    covers: header.covers,
    developers: header.developers,
  }
}

async function published(api: ApiClient, gameId: number): Promise<WalkthroughItem[]> {
  const found = await api.get('/walkthrough/game/{id}', {
    params: {
      path: { id: gameId },
      query: { page: 1, pageSize: othersShown + 1, status: 'PUBLISHED' },
    },
  })
  return found.items ?? []
}

function written(api: ApiClient, walkthroughId: number): Promise<Walkthrough> {
  return api.get('/walkthrough/{id}', {
    params: { path: { id: walkthroughId }, query: { withContent: 'true' } },
  })
}
