import { describe, expect, it } from 'vitest'
import {
  conditioned,
  facesIn,
  facesOf,
  portraitsIn,
  requiredBy,
  rowsOf,
  routeSearch,
  saveAnchor,
  shownRoute,
  stateOf,
  walkthroughPath,
  writingPath,
  writtenBy,
  type Credit,
  type Route,
  type WalkthroughSummary,
} from './walkthrough'
import type { Step } from './walkthrough-steps'

function step(kind: Step['kind'], fields: Partial<Step> = {}): Step {
  return { kind, text: '', remark: '', slot: '', ...fields }
}

function route(key: string, fields: Partial<Route> = {}): Route {
  return {
    key,
    name: key,
    characters: [],
    requires: [],
    condition: '',
    ending: '',
    steps: [],
    ...fields,
  }
}

function summary(id: number, creatorId: number): WalkthroughSummary {
  return {
    id,
    route_count: 1,
    lang: null,
    updated: '2026-10-11T00:00:00.000Z',
    status: 'PUBLISHED',
    review_pending: false,
    creator: { id: creatorId, name: `user${creatorId}`, avatar: null, is_sponsor: false },
  }
}

describe('paths', () => {
  it('leads to the tab, to one walkthrough and to the page that writes it', () => {
    expect(walkthroughPath('zh', 7, 12)).toBe('/zh/game/7/walkthrough/12')
    expect(writingPath('ja', 7)).toBe('/ja/game/7/walkthrough/edit')
  })

  it('names a route by its place and a save by its number', () => {
    expect(routeSearch(2)).toBe('?route=3')
    expect(saveAnchor('01')).toBe('save-1')
  })
})

describe('stateOf', () => {
  it('tells a walkthrough under review from one that was refused', () => {
    expect(stateOf({ status: 'PUBLISHED', review_pending: false })).toBe('published')
    expect(stateOf({ status: 'DRAFT', review_pending: false })).toBe('draft')
    expect(stateOf({ status: 'HIDDEN', review_pending: true })).toBe('reviewing')
    expect(stateOf({ status: 'HIDDEN', review_pending: false })).toBe('hidden')
  })
})

describe('writtenBy', () => {
  it('finds the walkthrough the viewer wrote', () => {
    const summaries = [summary(1, 5), summary(2, 9)]
    expect(writtenBy(summaries, 9)?.id).toBe(2)
    expect(writtenBy(summaries, 3)).toBeUndefined()
    expect(writtenBy(summaries, undefined)).toBeUndefined()
  })
})

describe('faces', () => {
  const credit = (id: number, name: string, image: string | null): Credit => ({
    image,
    image_thumb_hash: image === null ? null : 'in-game-hash',
    character: {
      id,
      name_jp: name,
      name_zh: '',
      name_en: '',
      image: 'portrait.webp',
      image_thumb_hash: 'portrait-hash',
    },
  })

  it('takes the name in the reader’s language and the picture used in this game', () => {
    expect(facesOf([credit(7, 'むぎ', 'in-game.webp'), credit(9, '緋華', null)], 'zh')).toEqual([
      { id: 7, name: 'むぎ', picture: 'in-game.webp', thumbhash: 'in-game-hash' },
      { id: 9, name: '緋華', picture: 'portrait.webp', thumbhash: 'portrait-hash' },
    ])
  })

  it('skips a character the game no longer lists', () => {
    const faces = [{ id: 7, name: 'むぎ', picture: undefined }]
    expect(facesIn(route('a', { characters: [9, 7] }), faces)).toEqual(faces)
  })
})

describe('portraits', () => {
  const faces = [
    { id: 1, name: '芳乃', picture: 'a.webp' },
    { id: 2, name: '茉子', picture: 'b.webp' },
    { id: 3, name: '丛雨', picture: undefined },
    { id: 4, name: '蕾娜', picture: 'd.webp' },
  ]

  it('shows the characters of a route that have a picture, in the route’s order', () => {
    expect(portraitsIn(route('a', { characters: [2, 3, 1] }), faces)).toEqual([
      { id: 2, picture: 'b.webp' },
      { id: 1, picture: 'a.webp' },
    ])
    expect(portraitsIn(route('a', { characters: [3] }), faces)).toEqual([])
    expect(portraitsIn(route('a'), faces)).toEqual([])
  })
})

describe('shownRoute', () => {
  const routes = [route('a'), route('b')]

  it('shows the first route until the address names another', () => {
    expect(shownRoute(routes, undefined)).toBe(0)
    expect(shownRoute(routes, 2)).toBe(1)
  })

  it('shows the first route when the address names one that is not there', () => {
    expect(shownRoute(routes, 3)).toBe(0)
  })

  it('shows none when the walkthrough has no routes', () => {
    expect(shownRoute([], undefined)).toBeUndefined()
    expect(shownRoute([], 1)).toBeUndefined()
  })
})

describe('conditions', () => {
  const routes = [
    route('a', { name: 'A' }),
    route('b', { name: 'B' }),
    route('c', { name: 'C', requires: ['b', 'a', 'gone'], condition: '三点' }),
  ]

  it('lists the routes to finish first in the order of the walkthrough', () => {
    expect(requiredBy(routes, 2)).toEqual([
      { ordinal: 1, name: 'A' },
      { ordinal: 2, name: 'B' },
    ])
    expect(requiredBy(routes, 0)).toEqual([])
  })

  it('marks a route that anything opens', () => {
    expect(routes.map(conditioned)).toEqual([false, false, true])
    expect(conditioned(route('d', { condition: '二周目' }))).toBe(true)
  })
})

describe('rowsOf', () => {
  const first = route('a', {
    name: 'むぎ',
    ending: 'むぎEND',
    steps: [
      step('note', { text: '【START】' }),
      step('choice', { text: '左' }),
      step('save', { slot: '01' }),
      step('gap'),
      step('choice', { text: 'メイド', remark: 'むぎ＆緋華' }),
    ],
  })
  const second = route('b', {
    name: '黒依',
    steps: [
      step('load', { slot: '1' }),
      step('choice', { text: '黒依' }),
      step('save', { slot: '02' }),
    ],
  })
  const third = route('c', {
    name: '凛々',
    steps: [
      step('save', { slot: '03' }),
      step('load', { slot: '03' }),
      step('load', { slot: '02' }),
    ],
  })

  it('numbers the choices and ends with the ending', () => {
    expect(rowsOf([first], 0)).toEqual([
      { kind: 'note', text: '【START】' },
      { kind: 'choice', number: 1, text: '左', remark: '' },
      { kind: 'save', slot: '01' },
      { kind: 'gap' },
      { kind: 'choice', number: 2, text: 'メイド', remark: 'むぎ＆緋華' },
      { kind: 'ending', text: 'むぎEND' },
    ])
    expect(rowsOf([first], 4)).toEqual([])
  })

  it('says which route a loaded save was made in, unless it is this one', () => {
    const routes = [first, second, third]
    expect(rowsOf(routes, 1)[0]).toEqual({
      kind: 'load',
      slot: '1',
      source: { ordinal: 1, name: 'むぎ' },
    })
    expect(rowsOf(routes, 2).slice(1)).toEqual([
      { kind: 'load', slot: '03', source: undefined },
      { kind: 'load', slot: '02', source: { ordinal: 2, name: '黒依' } },
    ])
  })

  it('looks in later routes when no earlier one made the save', () => {
    const routes = [route('x', { steps: [step('load', { slot: '02' })] }), second]
    expect(rowsOf(routes, 0)).toEqual([
      { kind: 'load', slot: '02', source: { ordinal: 2, name: '黒依' } },
    ])
    expect(rowsOf([route('x', { steps: [step('load', { slot: '09' })] })], 0)).toEqual([
      { kind: 'load', slot: '09', source: undefined },
    ])
  })
})
