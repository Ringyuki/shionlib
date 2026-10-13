import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { commentCommand, filterFrom, statusFilterFrom, statusFrom } from './admin-comment.schema'

describe('filterFrom', () => {
  it('reads the filters and the opened comment', () => {
    expect(
      filterFrom(new URLSearchParams('status=ALL&q=%20group%20&author=7&sort=oldest&id=12'), 2),
    ).toEqual({ status: 'ALL', query: 'group', author: 7, sort: 'oldest', opened: 12, page: 2 })
    expect(filterFrom(new URLSearchParams('status=3'), 1).status).toBe(3)
  })

  it('falls back to what waits, newest first', () => {
    expect(filterFrom(new URLSearchParams('status=9&author=x&sort=random&id=0'), 1)).toEqual({
      status: 2,
      query: '',
      author: undefined,
      sort: 'newest',
      opened: undefined,
      page: 1,
    })
  })
})

describe('guards', () => {
  it('accept only known statuses', () => {
    expect(statusFrom(3)).toBe(3)
    expect(statusFrom(4)).toBeUndefined()
    expect(statusFilterFrom('ALL')).toBe('ALL')
    expect(statusFilterFrom('1')).toBe(1)
    expect(statusFilterFrom('x')).toBeUndefined()
  })

  it('read a change by its action', () => {
    const review = {
      action: 'review',
      ids: [4, 5],
      status: 3,
      category: 'SPAM',
      reason: '',
      notify: true,
    }
    expect(parseOptional(commentCommand, review)).toEqual(review)
    expect(parseOptional(commentCommand, { ...review, ids: [] })).toBeUndefined()
    expect(parseOptional(commentCommand, { ...review, status: 2 })).toBeUndefined()
    expect(parseOptional(commentCommand, { action: 'rescan', id: 4 })).toEqual({
      action: 'rescan',
      id: 4,
    })
  })
})
