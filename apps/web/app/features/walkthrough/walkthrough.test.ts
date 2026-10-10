import { describe, expect, it } from 'vitest'
import { createFormKit } from '~/shared/form/form-kit'
import { blankDocument, type RichDocument } from '~/shared/richtext/rich-text'
import {
  contentsOf,
  isUnsaved,
  searchOnShelf,
  stateOf,
  statusOf,
  walkthroughPath,
  walkthroughsPath,
  writingPath,
  writtenBy,
} from './walkthrough'
import { firstInvalid, shelfFrom, walkthroughForm } from './walkthrough.schema'

const written: RichDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '选 A' }] }],
}

describe('addresses', () => {
  it('reads a walkthrough under its game and writes one at its own address', () => {
    expect(walkthroughsPath('zh', 7)).toBe('/zh/game/7/walkthrough')
    expect(walkthroughPath('en', 7, 12)).toBe('/en/game/7/walkthrough/12')
    expect(writingPath('ja', 7)).toBe('/ja/game/7/walkthrough/new')
    expect(writingPath('ja', 7, 12)).toBe('/ja/game/7/walkthrough/12/edit')
  })
})

describe('shelves', () => {
  it('keeps the whole shelf out of the address and goes back to the first page', () => {
    expect(searchOnShelf('?page=3', 'draft')).toBe('?status=draft')
    expect(searchOnShelf('?status=draft&page=2', 'all')).toBe('')
  })

  it('reads the shelf of an address and asks the API for its status', () => {
    expect(shelfFrom('published')).toBe('published')
    expect(shelfFrom('deleted')).toBe('all')
    expect(shelfFrom(null)).toBe('all')
    expect(statusOf('all')).toBeUndefined()
    expect(statusOf('published')).toBe('PUBLISHED')
    expect(statusOf('draft')).toBe('DRAFT')
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

describe('writing', () => {
  it('holds a change until what was written equals what is stored', () => {
    const stored = { title: '全线攻略', content: written }
    expect(isUnsaved(stored, stored)).toBe(false)
    expect(isUnsaved({ title: '全线攻略', content: structuredClone(written) }, stored)).toBe(false)
    expect(isUnsaved({ title: '全线攻略 2', content: written }, stored)).toBe(true)
    expect(isUnsaved({ title: '全线攻略', content: blankDocument }, stored)).toBe(true)
  })

  it('lets its author write a walkthrough, and anyone start a new one', () => {
    expect(writtenBy({ authorId: undefined }, 2)).toBe(true)
    expect(writtenBy({ authorId: 2 }, 2)).toBe(true)
    expect(writtenBy({ authorId: 3 }, 2)).toBe(false)
  })

  it('asks for a title and for a body, the title first', () => {
    const form = walkthroughForm(
      createFormKit(issue => issue.kind),
      issue => issue,
    )
    const messages = (values: { title: string; content: RichDocument }) =>
      form['~run']({ value: values }, {}).issues?.map(issue => issue.message)
    expect(messages({ title: ' ', content: blankDocument })?.[0]).toBe('title')
    expect(messages({ title: '全线攻略', content: blankDocument })).toEqual(['content'])
    expect(messages({ title: '全线攻略', content: written })).toBeUndefined()
    expect(firstInvalid(form, { title: '', content: blankDocument })).toBe('title')
    expect(firstInvalid(form, { title: '全线攻略', content: blankDocument })).toBe('content')
    expect(firstInvalid(form, { title: '全线攻略', content: written })).toBeUndefined()
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
