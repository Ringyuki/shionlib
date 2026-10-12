import { describe, expect, it } from 'vitest'
import {
  languageOf,
  narrowed,
  searchOf,
  searchWith,
  stepsOf,
  type Narrowing,
} from './admin-walkthrough'

const everything: Narrowing = { status: 'ALL', query: '', author: undefined, sort: 'updated' }

describe('the address of the list', () => {
  it('leaves out what is already the default', () => {
    expect(searchOf(everything)).toBe('')
    expect(searchOf({ status: 'HELD', query: 'route', author: 7, sort: 'created' })).toBe(
      '?status=HELD&q=route&author=7&sort=created',
    )
    expect(searchWith('?status=HELD', 8)).toBe('?status=HELD&id=8')
    expect(searchWith('?status=HELD&id=8', undefined)).toBe('?status=HELD')
  })

  it('knows when the list has been narrowed', () => {
    expect(narrowed(everything)).toBe(false)
    expect(narrowed({ ...everything, status: 'DELETED' })).toBe(true)
    expect(narrowed({ ...everything, author: 3 })).toBe(true)
  })
})

describe('what a walkthrough holds', () => {
  it('counts the steps a reader follows, not the gaps between them', () => {
    const step = (kind: 'choice' | 'save' | 'gap') => ({ kind, text: '', remark: '', slot: '' })
    expect(stepsOf({ steps: [step('choice'), step('gap'), step('save')] })).toBe(2)
    expect(stepsOf({ steps: null })).toBe(0)
  })

  it('names the language it was recognised as', () => {
    expect(languageOf({ lang: 'ja' })).toBe('ja')
    expect(languageOf({ lang: null })).toBe('unknown')
    expect(languageOf({ lang: 'ko' })).toBe('unknown')
  })
})
