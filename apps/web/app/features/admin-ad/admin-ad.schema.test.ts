import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { blankAd } from './admin-ad'
import { adCommand, filterFrom } from './admin-ad.schema'

const accepts = (schema: Parameters<typeof parseOptional>[0], value: unknown) =>
  parseOptional(schema, value) !== undefined

describe('filterFrom', () => {
  it('reads the filter and drops what it does not know', () => {
    expect(filterFrom(new URLSearchParams('status=scheduled&slot=game&ad=5&days=7'), 2)).toEqual({
      status: 'scheduled',
      slot: 'game',
      ad: 5,
      days: '7',
      page: 2,
    })
    expect(filterFrom(new URLSearchParams('status=paused&slot=top&ad=x&days=90'), 1)).toEqual({
      status: undefined,
      slot: undefined,
      ad: undefined,
      days: '30',
      page: 1,
    })
  })
})

describe('adCommand', () => {
  it('takes the values of the form and the small changes of the list', () => {
    expect(accepts(adCommand, { action: 'create', values: blankAd })).toBe(true)
    expect(accepts(adCommand, { action: 'enabled', id: 3, enabled: false })).toBe(true)
    expect(
      accepts(adCommand, { action: 'update', id: 3, values: { ...blankAd, slots: ['top'] } }),
    ).toBe(false)
  })
})
