import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import {
  countWalkthroughs,
  loadDraft,
  loadReading,
  loadUserWalkthroughs,
  publishWalkthrough,
  saveWalkthrough,
} from './walkthrough.use-cases'

const content: RichDocument = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '共通线' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '选 A' }] },
  ],
}

const walkthrough: ApiData<'/walkthrough/{id}', 'get'> = {
  id: 12,
  game_id: 7,
  title: '全线攻略',
  text: '共通线\n选 A',
  excerpt: '共通线 选 A',
  lang: 'zh',
  created: '2026-10-09T00:00:00Z',
  updated: '2026-10-09T00:00:00Z',
  edited: false,
  status: 'PUBLISHED',
  review_pending: false,
  creator: { id: 2, name: 'kotori', avatar: null, is_sponsor: false },
  content,
}

const header = {
  id: 7,
  title_jp: 'タイトル',
  title_zh: '标题',
  title_en: '',
  covers: null,
  developers: null,
}

const gameHeader: ApiData<'/game/{id}/header', 'get'> = {
  ...header,
  v_id: null,
  b_id: null,
  h_id: null,
  extra_info: null,
  aliases: null,
  covers: null,
  developers: null,
  release_date: null,
  release_date_tba: false,
  type: null,
  platform: null,
  content_limit: 0,
}

const item = (
  id: number,
): NonNullable<ApiData<'/walkthrough/game/{id}', 'get'>['items']>[number] => ({
  id,
  title: `攻略 ${id}`,
  excerpt: '',
  lang: 'zh',
  created: walkthrough.created,
  updated: walkthrough.updated,
  edited: false,
  status: 'PUBLISHED',
  review_pending: false,
  creator: walkthrough.creator,
})

const listed = (ids: number[]): ApiData<'/walkthrough/game/{id}', 'get'> => ({
  items: ids.map(item),
  meta: {
    currentPage: 1,
    itemCount: ids.length,
    itemsPerPage: 20,
    totalItems: ids.length,
    totalPages: 1,
    content_limit: 0,
  },
})

function api() {
  return fakeApi()
    .on('get', '/game/{id}/header', gameHeader)
    .on('get', '/walkthrough/{id}', walkthrough)
    .on('get', '/walkthrough/game/{id}', listed([12, 13]))
    .on('get', '/game/{id}/download-source', null)
}

describe('reading', () => {
  it('loads a walkthrough with its game and the other walkthroughs of that game', async () => {
    const fake = api()
    await expect(loadReading(fake.api, 7, 12)).resolves.toEqual({
      game: header,
      resources: 0,
      walkthrough,
      content,
      others: [item(13)],
    })
    const asked = fake.requests.find(request => request.url.includes('/walkthrough/12'))
    expect(new URL(asked?.url ?? '').searchParams.get('withContent')).toBe('true')
    const others = fake.requests.find(request => request.url.includes('/walkthrough/game/7'))
    expect(new URL(others?.url ?? '').searchParams.get('status')).toBe('PUBLISHED')
  })

  it('finds nothing under the address of another game', async () => {
    await expect(loadReading(api().api, 8, 12)).resolves.toBeUndefined()
    await expect(loadDraft(api().api, 8, 12)).resolves.toBeUndefined()
  })

  it('counts the walkthroughs of a game', async () => {
    const fake = fakeApi().on('get', '/walkthrough/game/{id}', listed([1, 2, 3]))
    await expect(countWalkthroughs(fake.api, 7)).resolves.toBe(3)
  })

  it('asks for one shelf of what a user wrote', async () => {
    const fake = fakeApi().on('get', '/user/datas/{id}/walkthroughs', {
      items: null,
      meta: {
        currentPage: 1,
        itemCount: 0,
        itemsPerPage: 20,
        totalItems: 0,
        totalPages: 1,
        content_limit: 0,
        is_current_user: true,
      },
    })
    await expect(loadUserWalkthroughs(fake.api, 2, 1, 'draft')).resolves.toMatchObject({
      shelf: 'draft',
      total: 0,
    })
    await loadUserWalkthroughs(fake.api, 2, 1, 'all')
    const asked = fake.requests.map(request => new URL(request.url).searchParams.get('status'))
    expect(asked).toEqual(['DRAFT', null])
  })
})

describe('writing', () => {
  it('starts an empty draft for a new walkthrough and fills one from an existing', async () => {
    await expect(loadDraft(api().api, 7, undefined)).resolves.toEqual({
      game: header,
      walkthroughId: undefined,
      authorId: undefined,
      title: '',
      content: blankDocument,
      state: 'draft',
    })
    await expect(loadDraft(api().api, 7, 12)).resolves.toMatchObject({
      walkthroughId: 12,
      authorId: 2,
      title: '全线攻略',
      content,
      state: 'published',
    })
  })

  it('creates a walkthrough for the game and tells what it became', async () => {
    const fake = fakeApi().on('post', '/walkthrough', { ...walkthrough, status: 'DRAFT' })
    await expect(
      saveWalkthrough(fake.api, { gameId: 7, title: ' 全线攻略 ', content, publish: false }),
    ).resolves.toEqual({ id: 12, state: 'draft' })
    await expect(fake.requests[0]?.json()).resolves.toMatchObject({
      game_id: 7,
      title: '全线攻略',
      status: 'DRAFT',
      content,
    })
  })

  it('replaces an existing walkthrough', async () => {
    const fake = fakeApi().on('patch', '/walkthrough/{id}', {
      ...walkthrough,
      status: 'HIDDEN',
      review_pending: true,
    })
    await expect(
      saveWalkthrough(fake.api, {
        gameId: 7,
        walkthroughId: 12,
        title: '全线攻略',
        content,
        publish: true,
      }),
    ).resolves.toEqual({ id: 12, state: 'reviewing' })
    const sent = fake.requests[0]
    expect(`${sent?.method} ${new URL(sent?.url ?? '').pathname}`).toBe('PATCH /walkthrough/12')
    const body: unknown = await sent?.json()
    expect(body).toMatchObject({ status: 'PUBLISHED' })
    expect(body).not.toHaveProperty('game_id')
  })

  it('publishes a draft with what is stored', async () => {
    const fake = fakeApi()
      .on('get', '/walkthrough/{id}', { ...walkthrough, status: 'DRAFT' })
      .on('patch', '/walkthrough/{id}', walkthrough)
    await expect(publishWalkthrough(fake.api, { walkthroughId: 12 })).resolves.toEqual({
      id: 12,
      state: 'published',
    })
    await expect(fake.requests[1]?.json()).resolves.toEqual({
      title: '全线攻略',
      content,
      status: 'PUBLISHED',
    })
  })
})
