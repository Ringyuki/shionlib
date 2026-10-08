import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { lexicalDocument } from '~/shared/markup/lexical-document'
import { countWalkthroughs, loadDraft, loadReading, saveWalkthrough } from './walkthrough.use-cases'

const source = '[h2]共通线[/h2]\n选 A'

const walkthrough: ApiData<'/walkthrough/{id}', 'get'> = {
  id: 12,
  game_id: 7,
  title: '全线攻略',
  html: '',
  lang: 'zh',
  created: '2026-10-09T00:00:00Z',
  updated: '2026-10-09T00:00:00Z',
  edited: false,
  status: 'PUBLISHED',
  review_pending: false,
  creator: { id: 2, name: 'kotori', avatar: null, is_sponsor: false },
  content: lexicalDocument(source),
}

const header = { id: 7, title_jp: 'タイトル', title_zh: '标题', title_en: '' }

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

const listed = (totalItems: number): ApiData<'/walkthrough/game/{id}', 'get'> => ({
  items: null,
  meta: {
    currentPage: 1,
    itemCount: 0,
    itemsPerPage: 1,
    totalItems,
    totalPages: 1,
    content_limit: 0,
  },
})

function api() {
  return fakeApi()
    .on('get', '/game/{id}/header', gameHeader)
    .on('get', '/walkthrough/{id}', walkthrough)
}

describe('reading', () => {
  it('loads a walkthrough with the game it belongs to and its text as it is written', async () => {
    const fake = api()
    await expect(loadReading(fake.api, 7, 12)).resolves.toEqual({
      game: header,
      walkthrough,
      source,
    })
    const asked = fake.requests.find(request => request.url.includes('/walkthrough/12'))
    expect(new URL(asked?.url ?? '').searchParams.get('withContent')).toBe('true')
  })

  it('finds nothing under the address of another game', async () => {
    await expect(loadReading(api().api, 8, 12)).resolves.toBeUndefined()
    await expect(loadDraft(api().api, 8, 12)).resolves.toBeUndefined()
  })

  it('counts the walkthroughs of a game', async () => {
    const fake = fakeApi().on('get', '/walkthrough/game/{id}', listed(3))
    await expect(countWalkthroughs(fake.api, 7)).resolves.toBe(3)
  })
})

describe('writing', () => {
  it('starts an empty draft for a new walkthrough and fills one from an existing', async () => {
    await expect(loadDraft(api().api, 7, undefined)).resolves.toEqual({
      game: header,
      walkthroughId: undefined,
      title: '',
      content: '',
      published: false,
    })
    await expect(loadDraft(api().api, 7, 12)).resolves.toMatchObject({
      walkthroughId: 12,
      title: '全线攻略',
      content: source,
      published: true,
    })
  })

  it('creates a walkthrough for the game, as a draft or for publication', async () => {
    const fake = fakeApi().on('post', '/walkthrough', walkthrough)
    await saveWalkthrough(fake.api, {
      gameId: 7,
      title: ' 全线攻略 ',
      content: source,
      publish: false,
    })
    await expect(fake.requests[0]?.json()).resolves.toMatchObject({
      game_id: 7,
      title: '全线攻略',
      status: 'DRAFT',
      content: { root: { children: [{ type: 'heading', tag: 'h2' }, { type: 'paragraph' }] } },
    })
  })

  it('replaces an existing walkthrough', async () => {
    const fake = fakeApi().on('patch', '/walkthrough/{id}', walkthrough)
    await saveWalkthrough(fake.api, {
      gameId: 7,
      walkthroughId: 12,
      title: '全线攻略',
      content: source,
      publish: true,
    })
    const sent = fake.requests[0]
    expect(`${sent?.method} ${new URL(sent?.url ?? '').pathname}`).toBe('PATCH /walkthrough/12')
    const body: unknown = await sent?.json()
    expect(body).toMatchObject({ status: 'PUBLISHED' })
    expect(body).not.toHaveProperty('game_id')
  })
})
