import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { slotFrom, viewsCommand } from './ad.schema'

const accepts = (schema: Parameters<typeof parseOptional>[0], value: unknown) =>
  parseOptional(schema, value) !== undefined

describe('slotFrom', () => {
  it('reads a known slot and nothing else', () => {
    expect(slotFrom(new URLSearchParams('slot=download'))).toBe('download')
    expect(slotFrom(new URLSearchParams('slot=banner'))).toBeUndefined()
    expect(slotFrom(new URLSearchParams(''))).toBeUndefined()
  })
})

describe('viewsCommand', () => {
  it('takes ads by id and slot', () => {
    expect(accepts(viewsCommand, { views: [{ ad_id: 1, slot: 'home' }] })).toBe(true)
    expect(accepts(viewsCommand, { views: [{ ad_id: 0, slot: 'home' }] })).toBe(false)
    expect(accepts(viewsCommand, { views: [{ ad_id: 1, slot: 'top' }] })).toBe(false)
  })
})
