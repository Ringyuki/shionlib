import { describe, expect, it } from 'vitest'
import { contentsOf, editorPath, stateOf, walkthroughPath, walkthroughsPath } from './walkthrough'

describe('addresses', () => {
  it('keeps the addresses the old site used', () => {
    expect(walkthroughsPath('zh', 7)).toBe('/zh/game/7/walkthrough')
    expect(walkthroughPath('en', 7, 12)).toBe('/en/game/7/walkthrough/12')
    expect(editorPath('ja', 7)).toBe('/ja/game/7/walkthrough/edit')
    expect(editorPath('ja', 7, 12)).toBe('/ja/game/7/walkthrough/edit?walkthrough_id=12')
  })
})

describe('stateOf', () => {
  it('tells a walkthrough waiting for review from one that was hidden', () => {
    expect(stateOf({ status: 'PUBLISHED', review_pending: false })).toBe('published')
    expect(stateOf({ status: 'DRAFT', review_pending: false })).toBe('draft')
    expect(stateOf({ status: 'HIDDEN', review_pending: true })).toBe('reviewing')
    expect(stateOf({ status: 'HIDDEN', review_pending: false })).toBe('hidden')
  })
})

describe('contentsOf', () => {
  it('puts the smaller headings under the heading before them', () => {
    expect(
      contentsOf([
        { id: 'section-1', level: 3, title: '前言' },
        { id: 'section-2', level: 2, title: '共通线' },
        { id: 'section-3', level: 3, title: '分支' },
        { id: 'section-4', level: 2, title: '结局' },
      ]),
    ).toEqual([
      { id: 'section-1', label: '前言', children: [] },
      { id: 'section-2', label: '共通线', children: [{ id: 'section-3', label: '分支' }] },
      { id: 'section-4', label: '结局', children: [] },
    ])
  })
})
