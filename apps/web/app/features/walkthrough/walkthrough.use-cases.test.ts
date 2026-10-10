import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import type { RichDocument } from '~/shared/richtext/rich-text'
import type { WalkthroughSummary } from './walkthrough'
import {
  loadGuides,
  loadUserWalkthroughs,
  loadWriting,
  removeWalkthrough,
  saveWalkthrough,
} from './walkthrough.use-cases'

const note: RichDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'セーブ01まで' }] }],
}

const walkthrough: ApiData<'/walkthrough/{id}', 'get'> = {
  id: 12,
  game_id: 7,
  note,
  routes: [
    {
      key: 'a',
      name: 'むぎ',
      characters: [3],
      requires: [],
      condition: '',
      ending: 'むぎEND',
      steps: [{ kind: 'choice', text: '左', remark: '', slot: '' }],
    },
  ],
  lang: 'jp',
  created: '2026-10-09T00:00:00Z',
  updated: '2026-10-09T00:00:00Z',
  status: 'PUBLISHED',
  review_pending: false,
  creator: { id: 2, name: 'kotori', avatar: null, is_sponsor: false },
}

const summary = (id: number, creatorId: number): WalkthroughSummary => ({
  id,
  route_count: 1,
  lang: 'jp',
  updated: walkthrough.updated,
  status: 'PUBLISHED',
  review_pending: false,
  creator: { ...walkthrough.creator, id: creatorId },
})

const header: ApiData<'/game/{id}/header', 'get'> = {
  id: 7,
  title_jp: 'タイトル',
  title_zh: '标题',
  title_en: '',
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

const cast: ApiData<'/game/{id}/characters', 'get'> = { characters: null, content_limit: 0 }

const paths = (requests: readonly Request[]) => requests.map(each => new URL(each.url).pathname)

describe('loadGuides', () => {
  it('shows the first walkthrough listed when the address names none', async () => {
    const { api, requests } = fakeApi()
      .on('get', '/walkthrough/game/{id}', [summary(12, 2), summary(15, 3)])
      .on('get', '/walkthrough/{id}', walkthrough)
    const guides = await loadGuides(api, 7, undefined)
    expect(guides?.summaries.map(each => each.id)).toEqual([12, 15])
    expect(guides?.shown).toEqual(walkthrough)
    expect(paths(requests)).toEqual(['/walkthrough/game/7', '/walkthrough/12'])
  })

  it('shows the walkthrough the address names', async () => {
    const { api, requests } = fakeApi()
      .on('get', '/walkthrough/game/{id}', [summary(15, 3)])
      .on('get', '/walkthrough/{id}', walkthrough)
    expect((await loadGuides(api, 7, 12))?.shown?.id).toBe(12)
    expect(paths(requests).toSorted()).toEqual(['/walkthrough/12', '/walkthrough/game/7'])
  })

  it('shows nothing for a game without walkthroughs', async () => {
    const { api } = fakeApi().on('get', '/walkthrough/game/{id}', null)
    expect(await loadGuides(api, 7, undefined)).toEqual({
      gameId: 7,
      summaries: [],
      shown: undefined,
    })
  })

  it('knows no walkthrough of another game under this address', async () => {
    const { api } = fakeApi()
      .on('get', '/walkthrough/game/{id}', [])
      .on('get', '/walkthrough/{id}', walkthrough)
    expect(await loadGuides(api, 8, 12)).toBeUndefined()
  })

  it('leaves a walkthrough the viewer may not read to the error page', async () => {
    const { api } = fakeApi()
      .on('get', '/walkthrough/game/{id}', [])
      .fail('get', '/walkthrough/{id}', 403, { code: 560102, message: 'not yours' })
    await expect(loadGuides(api, 7, 12)).rejects.toMatchObject({ status: 403 })
  })
})

describe('loadUserWalkthroughs', () => {
  it('asks for one page of what the user wrote', async () => {
    const { api, requests } = fakeApi().on('get', '/user/datas/{id}/walkthroughs', {
      items: null,
      meta: {
        currentPage: 2,
        itemCount: 0,
        itemsPerPage: 20,
        totalItems: 21,
        totalPages: 2,
        is_current_user: true,
        content_limit: 0,
      },
    })
    expect(await loadUserWalkthroughs(api, 5, 2)).toEqual({ items: [], total: 21, page: 2 })
    expect(new URL(requests[0]?.url ?? '').search).toBe('?page=2&pageSize=20')
  })
})

describe('loadWriting', () => {
  it('opens what the writer wrote before', async () => {
    const { api } = fakeApi()
      .on('get', '/game/{id}/header', header)
      .on('get', '/game/{id}/characters', cast)
      .on('get', '/walkthrough/game/{id}', [summary(15, 3), summary(12, 2)])
      .on('get', '/walkthrough/{id}', walkthrough)
    const writing = await loadWriting(api, 7, 2)
    expect(writing.game).toEqual({ id: 7, title_jp: 'タイトル', title_zh: '标题', title_en: '' })
    expect(writing.credits).toEqual([])
    expect(writing.stored).toEqual(walkthrough)
  })

  it('starts from nothing for a writer without a walkthrough and for a guest', async () => {
    const fake = fakeApi()
      .on('get', '/game/{id}/header', header)
      .on('get', '/game/{id}/characters', cast)
      .on('get', '/walkthrough/game/{id}', [summary(15, 3)])
    expect((await loadWriting(fake.api, 7, 2)).stored).toBeUndefined()
    expect((await loadWriting(fake.api, 7, undefined)).stored).toBeUndefined()
    expect(paths(fake.requests).filter(path => path === '/walkthrough/game/7')).toHaveLength(1)
  })
})

describe('saveWalkthrough', () => {
  const routes = [
    {
      key: 'a',
      name: 'むぎ',
      characters: [3],
      requires: [],
      condition: '',
      ending: 'むぎEND',
      steps: [
        { kind: 'note' as const, text: '【START】', remark: '', slot: '' },
        { kind: 'choice' as const, text: '左', remark: '', slot: '' },
        { kind: 'choice' as const, text: 'メイド', remark: 'むぎ＆緋華', slot: '' },
        { kind: 'save' as const, text: '', remark: '', slot: '01' },
        { kind: 'gap' as const, text: '', remark: '', slot: '' },
        { kind: 'load' as const, text: '', remark: '', slot: '01' },
      ],
    },
  ]

  it('sends each step with the fields of its kind and asks for publication', async () => {
    const { api, requests } = fakeApi().on('put', '/walkthrough/game/{id}/mine', {
      ...walkthrough,
      status: 'HIDDEN',
      review_pending: true,
    })
    const saved = await saveWalkthrough(api, { gameId: 7, note, routes, publish: true })
    expect(saved).toEqual({ id: 12, state: 'reviewing' })
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/walkthrough/game/7/mine')
    expect(await requests[0]?.json()).toEqual({
      note,
      routes: [
        {
          ...routes[0],
          steps: [
            { kind: 'note', text: '【START】' },
            { kind: 'choice', text: '左' },
            { kind: 'choice', text: 'メイド', remark: 'むぎ＆緋華' },
            { kind: 'save', slot: '01' },
            { kind: 'gap' },
            { kind: 'load', slot: '01' },
          ],
        },
      ],
      status: 'PUBLISHED',
    })
  })

  it('saves a draft without a note', async () => {
    const { api, requests } = fakeApi().on('put', '/walkthrough/game/{id}/mine', {
      ...walkthrough,
      status: 'DRAFT',
    })
    expect(await saveWalkthrough(api, { gameId: 7, routes: [], publish: false })).toEqual({
      id: 12,
      state: 'draft',
    })
    expect(await requests[0]?.json()).toEqual({ routes: [], status: 'DRAFT' })
  })

  it('lets the refusal of the API through', async () => {
    const { api } = fakeApi().fail('put', '/walkthrough/game/{id}/mine', 422, {
      code: 560105,
      message: '每条线路须有名称和至少一步',
    })
    await expect(
      saveWalkthrough(api, { gameId: 7, routes: [], publish: true }),
    ).rejects.toMatchObject({ status: 422, code: 560105 })
  })
})

describe('removeWalkthrough', () => {
  it('deletes the walkthrough', async () => {
    const { api, requests } = fakeApi().on('delete', '/walkthrough/{id}', undefined)
    await removeWalkthrough(api, { walkthroughId: 12 })
    expect(requests[0]?.method).toBe('DELETE')
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/walkthrough/12')
  })
})
