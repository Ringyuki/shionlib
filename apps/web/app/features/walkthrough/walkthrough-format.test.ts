import { describe, expect, it } from 'vitest'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import type { Draft, RouteDraft } from './walkthrough-draft'
import { elapsedText, filled, placed, type Formatted } from './walkthrough-format'

const words = { save: '存档', load: '读档' }

const naming = {
  faces: [
    { id: 519, name: '新谷 灯華', picture: undefined },
    { id: 520, name: '日紫喜 うぐいす', picture: undefined },
  ],
  separator: '、',
}

function paragraph(text: string): RichDocument {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function written(key: string): RouteDraft {
  return {
    key,
    name: '共通',
    named: true,
    characters: [],
    requires: [],
    condition: '',
    ending: '',
    steps: '存档 01',
  }
}

const formatted: Formatted = {
  note: paragraph('通关一次后即可直接进入'),
  routes: [
    {
      key: 'r1',
      name: '',
      characters: [519, 404],
      requires: [],
      condition: '',
      ending: '灯华 END',
      steps: [
        { kind: 'choice', text: '说不要去', remark: '灯华', slot: '' },
        { kind: 'save', text: '', remark: '', slot: '01' },
        { kind: 'note', text: '【After篇】', remark: '', slot: '' },
      ],
    },
    {
      key: 'r2',
      name: 'ハーレム',
      characters: [519, 520],
      requires: ['r1'],
      condition: '全员通关后',
      ending: '',
      steps: [{ kind: 'load', text: '', remark: '', slot: '01' }],
    },
  ],
}

const empty: Draft = { note: blankDocument, routes: [] }

describe('placed', () => {
  it('turns the result into routes named after their characters unless the text named them', () => {
    const { draft, added } = placed(empty, formatted, 'append', naming, words, 60)
    expect(draft.note).toEqual(formatted.note)
    expect(added).toEqual(['r1', 'r2'])
    expect(draft.routes).toEqual([
      {
        key: 'r1',
        name: '新谷 灯華',
        named: false,
        characters: [519],
        requires: [],
        condition: '',
        ending: '灯华 END',
        steps: '说不要去 | 灯华\n存档 01\n# 【After篇】',
      },
      {
        key: 'r2',
        name: 'ハーレム',
        named: true,
        characters: [519, 520],
        requires: ['r1'],
        condition: '全员通关后',
        ending: '',
        steps: '读档 01',
      },
    ])
  })

  it('appends after what is written, with keys and requirements of their own', () => {
    const current: Draft = { note: paragraph('原有说明'), routes: [written('r1'), written('r3')] }
    const { draft, added } = placed(current, formatted, 'append', naming, words, 60)
    expect(draft.routes.map(route => route.key)).toEqual(['r1', 'r3', 'r4', 'r5'])
    expect(draft.routes[3]?.requires).toEqual(['r4'])
    expect(added).toEqual(['r4', 'r5'])
    expect(draft.note.content).toHaveLength(2)
  })

  it('replaces the note and routes when asked, without reusing their keys', () => {
    const current: Draft = { note: paragraph('原有说明'), routes: [written('r1')] }
    const { draft } = placed(current, formatted, 'replace', naming, words, 60)
    expect(draft.note).toEqual(formatted.note)
    expect(draft.routes.map(route => route.key)).toEqual(['r2', 'r3'])
    expect(draft.routes[1]?.requires).toEqual(['r2'])
  })

  it('keeps the note written when the result has none and stops at the route limit', () => {
    const current: Draft = { note: paragraph('原有说明'), routes: [written('r1')] }
    const { draft, added } = placed(
      current,
      { routes: formatted.routes },
      'append',
      naming,
      words,
      2,
    )
    expect(draft.note).toEqual(current.note)
    expect(added).toEqual(['r2'])
    expect(draft.routes).toHaveLength(2)
  })
})

describe('filled', () => {
  it('tells an empty editor from one with a note or routes', () => {
    expect(filled(empty)).toBe(false)
    expect(filled({ note: paragraph('说明'), routes: [] })).toBe(true)
    expect(filled({ note: blankDocument, routes: [written('r1')] })).toBe(true)
  })
})

describe('elapsedText', () => {
  it('shows minutes and seconds', () => {
    expect(elapsedText(0)).toBe('0:00')
    expect(elapsedText(24_900)).toBe('0:24')
    expect(elapsedText(125_000)).toBe('2:05')
  })
})
