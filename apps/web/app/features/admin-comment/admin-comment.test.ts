import { describe, expect, it } from 'vitest'
import { awaiting, narrowed, searchOf, searchWith, type Narrowing } from './admin-comment'

const everything: Narrowing = { status: 2, query: '', author: undefined, sort: 'newest' }

describe('the address of the list', () => {
  it('leaves out what is already the default', () => {
    expect(searchOf(everything)).toBe('')
    expect(searchOf({ status: 'ALL', query: 'group', author: 7, sort: 'oldest' })).toBe(
      '?status=ALL&q=group&author=7&sort=oldest',
    )
    expect(searchOf({ ...everything, status: 3 })).toBe('?status=3')
  })

  it('opens and closes a comment without touching the filters', () => {
    expect(searchWith('?status=ALL&page=2', 9)).toBe('?status=ALL&page=2&id=9')
    expect(searchWith('?status=ALL&id=9', undefined)).toBe('?status=ALL')
  })

  it('knows when the list has been narrowed', () => {
    expect(narrowed(everything)).toBe(false)
    expect(narrowed({ ...everything, status: 'ALL' })).toBe(true)
    expect(narrowed({ ...everything, query: 'x' })).toBe(true)
    expect(narrowed({ ...everything, author: 3 })).toBe(true)
  })
})

describe('awaiting', () => {
  it('is true only while a comment is held', () => {
    expect(awaiting({ status: 2 })).toBe(true)
    expect(awaiting({ status: 1 })).toBe(false)
    expect(awaiting({ status: 3 })).toBe(false)
  })
})
