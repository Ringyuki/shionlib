import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { catalogQueryFrom, filterFrom, modelCommand } from './admin-ai-model.schema'

describe('filterFrom', () => {
  it('reads the search and the capability', () => {
    expect(filterFrom(new URLSearchParams('q=gpt&capability=vision'))).toEqual({
      query: 'gpt',
      capability: 'vision',
    })
    expect(filterFrom(new URLSearchParams('capability=speech'))).toEqual({
      query: '',
      capability: undefined,
    })
  })
})

describe('catalogQueryFrom', () => {
  it('trims the search and drops one that is too long', () => {
    expect(catalogQueryFrom('  haiku ')).toBe('haiku')
    expect(catalogQueryFrom(null)).toBe('')
    expect(catalogQueryFrom('x'.repeat(200))).toBe('')
  })
})

describe('modelCommand', () => {
  it('reads each kind of change', () => {
    expect(parseOptional(modelCommand, { action: 'syncCatalog' })).toEqual({
      action: 'syncCatalog',
    })
    expect(parseOptional(modelCommand, { action: 'reorder', id: 2, ids: [5, 4] })).toMatchObject({
      ids: [5, 4],
    })
    expect(
      parseOptional(modelCommand, {
        action: 'addRoute',
        id: 2,
        providerId: 1,
        upstreamId: 'gpt-5-mini',
        protocol: 'responses',
      }),
    ).toMatchObject({ providerId: 1, protocol: 'responses' })
  })

  it('refuses a protocol it does not know', () => {
    expect(
      parseOptional(modelCommand, {
        action: 'addRoute',
        id: 2,
        providerId: 1,
        upstreamId: 'gpt-5-mini',
        protocol: 'grpc',
      }),
    ).toBeUndefined()
  })
})
