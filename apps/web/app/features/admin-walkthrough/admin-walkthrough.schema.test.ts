import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { filterFrom, walkthroughCommand } from './admin-walkthrough.schema'

describe('filterFrom', () => {
  it('reads the filters and the opened walkthrough', () => {
    expect(
      filterFrom(new URLSearchParams('status=HELD&q=route&author=7&sort=created&id=8'), 2),
    ).toEqual({
      status: 'HELD',
      query: 'route',
      author: 7,
      sort: 'created',
      opened: 8,
      page: 2,
    })
  })

  it('falls back to everything, the latest update first', () => {
    expect(filterFrom(new URLSearchParams('status=PENDING&sort=name&id=x'), 1)).toEqual({
      status: 'ALL',
      query: '',
      author: undefined,
      sort: 'updated',
      opened: undefined,
      page: 1,
    })
  })
})

describe('walkthroughCommand', () => {
  it('takes a status an administrator may set, or a rescan', () => {
    expect(
      parseOptional(walkthroughCommand, { action: 'status', id: 8, status: 'HIDDEN' }),
    ).toEqual({
      action: 'status',
      id: 8,
      status: 'HIDDEN',
    })
    expect(
      parseOptional(walkthroughCommand, { action: 'status', id: 8, status: 'DRAFT' }),
    ).toBeUndefined()
    expect(parseOptional(walkthroughCommand, { action: 'rescan', id: 8 })).toEqual({
      action: 'rescan',
      id: 8,
    })
  })
})
