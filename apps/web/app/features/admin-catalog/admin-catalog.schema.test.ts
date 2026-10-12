import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { catalogCommand, lookupFrom, outcomeFrom } from './admin-catalog.schema'

describe('lookupFrom', () => {
  it('reads the source, the kind of entry and the words', () => {
    expect(
      lookupFrom(new URLSearchParams('source=hikarinagi&entity=developer&q=%20枕%20')),
    ).toEqual({ source: 'hikarinagi', entity: 'developer', query: '枕' })
  })

  it('falls back to games and to nothing to look for', () => {
    expect(lookupFrom(new URLSearchParams('entity=tag'))).toEqual({
      source: '',
      entity: 'game',
      query: '',
    })
  })
})

describe('outcomeFrom', () => {
  it('knows how an authorization ended', () => {
    expect(outcomeFrom('authorized')).toBe('authorized')
    expect(outcomeFrom('failed')).toBe('failed')
    expect(outcomeFrom('done')).toBeUndefined()
    expect(outcomeFrom(null)).toBeUndefined()
  })
})

describe('catalogCommand', () => {
  it('reads a change by its action', () => {
    const entry = { action: 'import', source: 'hikarinagi', entity: 'game', externalId: '18342' }
    expect(parseOptional(catalogCommand, entry)).toEqual(entry)
    expect(parseOptional(catalogCommand, { action: 'sync', source: 'hikarinagi' })).toEqual({
      action: 'sync',
      source: 'hikarinagi',
    })
  })

  it('refuses a change without its source, entry or a known kind', () => {
    expect(parseOptional(catalogCommand, { action: 'sync', source: '' })).toBeUndefined()
    expect(
      parseOptional(catalogCommand, {
        action: 'import',
        source: 'hikarinagi',
        entity: 'tag',
        externalId: '1',
      }),
    ).toBeUndefined()
    expect(
      parseOptional(catalogCommand, {
        action: 'import',
        source: 'hikarinagi',
        entity: 'game',
        externalId: '',
      }),
    ).toBeUndefined()
  })
})
