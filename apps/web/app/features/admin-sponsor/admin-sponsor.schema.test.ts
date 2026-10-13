import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { filterFrom, sponsorCommand } from './admin-sponsor.schema'

describe('filterFrom', () => {
  it('reads the status and falls back to every order', () => {
    expect(filterFrom(new URLSearchParams('status=EXPIRED'), 2)).toEqual({
      status: 'EXPIRED',
      page: 2,
    })
    expect(filterFrom(new URLSearchParams('status=PAID'), 1)).toEqual({
      status: undefined,
      page: 1,
    })
  })
})

describe('sponsorCommand', () => {
  it('reads a change by its action', () => {
    expect(parseOptional(sponsorCommand, { action: 'status', id: 4, status: 'REFUND' })).toEqual({
      action: 'status',
      id: 4,
      status: 'REFUND',
    })
    expect(parseOptional(sponsorCommand, { action: 'remove', id: 4 })).toEqual({
      action: 'remove',
      id: 4,
    })
  })

  it('refuses the statuses an administrator does not set', () => {
    expect(
      parseOptional(sponsorCommand, { action: 'status', id: 4, status: 'NEW' }),
    ).toBeUndefined()
    expect(
      parseOptional(sponsorCommand, { action: 'status', id: 4, status: 'EXPIRED' }),
    ).toBeUndefined()
    expect(parseOptional(sponsorCommand, { action: 'remove', id: 0 })).toBeUndefined()
  })
})
