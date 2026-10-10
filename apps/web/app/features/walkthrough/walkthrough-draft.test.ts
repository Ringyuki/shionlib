import { describe, expect, it } from 'vitest'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import type { Route } from './walkthrough'
import {
  cast,
  draftOf,
  named,
  nameOf,
  routesOf,
  sameDraft,
  savesOf,
  unfinished,
  withoutRoute,
  withRoute,
  withRouteChanged,
  withRouteMoved,
  writtenOf,
  type Draft,
  type RouteDraft,
} from './walkthrough-draft'

const words = { save: '存档', load: '读档' }

const naming = {
  faces: [
    { id: 7, name: 'むぎ', picture: undefined },
    { id: 9, name: '佐藤 緋華', picture: undefined },
  ],
  separator: '、',
}

const said: RichDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '说明' }] }],
}

function route(key: string, fields: Partial<RouteDraft> = {}): RouteDraft {
  return {
    key,
    name: key,
    named: true,
    characters: [],
    requires: [],
    condition: '',
    ending: '',
    steps: '左',
    ...fields,
  }
}

function draft(...routes: RouteDraft[]): Draft {
  return { note: blankDocument, routes }
}

describe('draftOf', () => {
  const stored: Route = {
    key: 'a',
    name: 'むぎ、佐藤 緋華',
    characters: [7, 9],
    requires: [],
    condition: '',
    ending: 'むぎ＆緋華END',
    steps: [
      { kind: 'choice', text: '左', remark: '', slot: '' },
      { kind: 'save', text: '', remark: '', slot: '01' },
    ],
  }

  it('starts from nothing for a walkthrough that is not written yet', () => {
    expect(draftOf(undefined, naming, words)).toEqual({ note: blankDocument, routes: [] })
  })

  it('writes the steps as lines and knows a name that follows the characters', () => {
    const written = draftOf(
      { note: said, routes: [stored, { ...stored, key: 'b', name: '共通' }] },
      naming,
      words,
    )
    expect(written.note).toBe(said)
    expect(written.routes[0]).toEqual({
      key: 'a',
      name: 'むぎ、佐藤 緋華',
      named: false,
      characters: [7, 9],
      requires: [],
      condition: '',
      ending: 'むぎ＆緋華END',
      steps: '左\n存档 01',
    })
    expect(written.routes[1]?.named).toBe(true)
  })

  it('lets go of a character the game no longer lists', () => {
    const written = draftOf({ routes: [{ ...stored, characters: [7, 404] }] }, naming, words)
    expect(written.routes[0]).toMatchObject({ characters: [7], named: true })
  })
})

describe('routes of a draft', () => {
  it('adds a route under a key no other route has', () => {
    const grown = withRoute(withRoute(draft(route('r2'))))
    expect(grown.routes.map(each => each.key)).toEqual(['r2', 'r3', 'r4'])
    expect(grown.routes[1]).toMatchObject({ name: '', named: false, steps: '' })
  })

  it('takes a removed route out of the conditions of the others', () => {
    const left = withoutRoute(
      draft(route('a'), route('b', { requires: ['a', 'c'] }), route('c')),
      'a',
    )
    expect(left.routes).toEqual([route('b', { requires: ['c'] }), route('c')])
  })

  it('moves a route to the place of another', () => {
    const routes = draft(route('a'), route('b'), route('c'))
    expect(withRouteMoved(routes, 'c', 'a').routes.map(each => each.key)).toEqual(['c', 'a', 'b'])
    expect(withRouteMoved(routes, 'a', 'c').routes.map(each => each.key)).toEqual(['b', 'c', 'a'])
    expect(withRouteMoved(routes, 'a', 'a')).toBe(routes)
    expect(withRouteMoved(routes, 'a', 'gone')).toBe(routes)
  })

  it('changes one route and leaves the others as they are', () => {
    const routes = draft(route('a'), route('b'))
    const changed = withRouteChanged(routes, 'b', each => ({ ...each, ending: 'END' }))
    expect(changed.routes[0]).toBe(routes.routes[0])
    expect(changed.routes[1]?.ending).toBe('END')
  })
})

describe('the name of a route', () => {
  it('follows the chosen characters until the author names the route', () => {
    const fresh = route('a', { name: '', named: false })
    const chosen = cast(fresh, [7, 9], naming)
    expect(chosen).toMatchObject({ characters: [7, 9], name: 'むぎ、佐藤 緋華', named: false })
    const renamed = named(chosen, '共通')
    expect(cast(renamed, [7], naming)).toMatchObject({ characters: [7], name: '共通', named: true })
    expect(cast(named(renamed, ' '), [9], naming).name).toBe('佐藤 緋華')
  })

  it('leaves out a character the game no longer lists', () => {
    expect(nameOf([9, 404], naming)).toBe('佐藤 緋華')
  })
})

describe('what a draft holds', () => {
  const written = draft(
    route('a', { name: ' むぎ ', ending: ' END ', steps: '◆セーブ01\n左 | むぎ\n\n存档 02' }),
    route('b', { name: '', steps: '\n\n' }),
  )

  it('reads the lines as steps and trims what is typed around them', () => {
    expect(routesOf(written)[0]).toEqual({
      key: 'a',
      name: 'むぎ',
      characters: [],
      requires: [],
      condition: '',
      ending: 'END',
      steps: [
        { kind: 'save', text: '', remark: '', slot: '01' },
        { kind: 'choice', text: '左', remark: 'むぎ', slot: '' },
        { kind: 'gap', text: '', remark: '', slot: '' },
        { kind: 'save', text: '', remark: '', slot: '02' },
      ],
    })
    expect(savesOf(written)).toEqual(['01', '02'])
  })

  it('leaves out a note nothing was written in', () => {
    expect(writtenOf(written).note).toBeUndefined()
    expect(writtenOf({ ...written, note: said }).note).toBe(said)
  })

  it('finds the first route that cannot be published', () => {
    expect(unfinished(written)).toEqual({ index: 1, name: true, steps: true })
    expect(unfinished(draft(route('a'), route('b', { steps: '# 备注' })))).toBeUndefined()
    expect(unfinished(draft(route('a', { name: ' ' })))).toEqual({
      index: 0,
      name: true,
      steps: false,
    })
  })
})

describe('sameDraft', () => {
  it('tells whether anything written differs from what is stored', () => {
    const stored = draft(route('a', { characters: [7] }), route('b'))
    expect(sameDraft(stored, draft(route('a', { characters: [7] }), route('b')))).toBe(true)
    expect(sameDraft(stored, { ...stored, note: said })).toBe(false)
    expect(sameDraft(stored, draft(route('b'), route('a', { characters: [7] })))).toBe(false)
    expect(sameDraft(stored, draft(route('a', { characters: [9] }), route('b')))).toBe(false)
    expect(
      sameDraft(
        stored,
        withRouteChanged(stored, 'b', each => ({ ...each, steps: '右' })),
      ),
    ).toBe(false)
    expect(sameDraft(stored, draft(route('a', { characters: [7] })))).toBe(false)
  })
})
