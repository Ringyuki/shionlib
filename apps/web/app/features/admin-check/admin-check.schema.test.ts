import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import {
  filterFrom,
  maxBatch,
  outcomeFrom,
  quickReviewCommand,
  stalledCommand,
} from './admin-check.schema'

describe('the address of the page', () => {
  it('reads the filter and the opened case, also from the address in older notices', () => {
    expect(filterFrom(new URLSearchParams('result=ADMIN_DELETE&case=4'), 2)).toEqual({
      outcome: 'ADMIN_DELETE',
      opened: 4,
      page: 2,
    })
    expect(filterFrom(new URLSearchParams('id=6'), 1).opened).toBe(6)
    expect(filterFrom(new URLSearchParams('result=KEPT&case=x'), 1)).toEqual({
      outcome: undefined,
      opened: undefined,
      page: 1,
    })
  })

  it('accepts only known outcomes', () => {
    expect(outcomeFrom('ADMIN_ALLOW')).toBe('ADMIN_ALLOW')
    expect(outcomeFrom(null)).toBeUndefined()
    expect(outcomeFrom('PENDING')).toBeUndefined()
  })
})

describe('the commands for several files at once', () => {
  const many = (count: number) => Array.from({ length: count }, (_, index) => index + 1)

  it('take every file the lists can show', () => {
    expect(
      parseOptional(quickReviewCommand, { ids: many(maxBatch), decision: 'ALLOW' }),
    ).toBeDefined()
    expect(
      parseOptional(stalledCommand, { fileIds: many(maxBatch), action: 'remove' }),
    ).toBeDefined()
  })

  it('need at least one file and no more than the lists show', () => {
    expect(parseOptional(quickReviewCommand, { ids: [], decision: 'ALLOW' })).toBeUndefined()
    expect(
      parseOptional(stalledCommand, { fileIds: many(maxBatch + 1), action: 'recheck' }),
    ).toBeUndefined()
    expect(parseOptional(stalledCommand, { fileIds: [0], action: 'recheck' })).toBeUndefined()
  })
})
