import { describe, expect, it } from 'vitest'
import { filterFrom, levelFrom, statusFrom } from './admin-report.schema'

describe('filterFrom', () => {
  it('reads the filters and ignores what it does not know', () => {
    expect(
      filterFrom(new URLSearchParams('status=INVALID&reason=OTHER&id=12&reporter=7'), 3),
    ).toEqual({
      status: 'INVALID',
      reason: 'OTHER',
      reporter: 7,
      uploader: undefined,
      opened: 12,
      page: 3,
    })
    expect(filterFrom(new URLSearchParams('status=DONE&reason=SPAM&id=x&uploader=x'), 1)).toEqual({
      status: 'PENDING',
      reason: undefined,
      reporter: undefined,
      uploader: undefined,
      opened: undefined,
      page: 1,
    })
  })
})

describe('guards', () => {
  it('accept only known statuses and levels', () => {
    expect(statusFrom('VALID')).toBe('VALID')
    expect(statusFrom('ALL')).toBeUndefined()
    expect(levelFrom('HIGH')).toBe('HIGH')
    expect(levelFrom('SEVERE')).toBeUndefined()
  })
})
