import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { filterFrom, kindFrom, providerCommand } from './admin-ai-provider.schema'

describe('filterFrom', () => {
  it('reads the search and the state', () => {
    expect(filterFrom(new URLSearchParams('q=%20open%20&state=suspended'))).toEqual({
      query: 'open',
      state: 'suspended',
    })
    expect(filterFrom(new URLSearchParams('state=broken'))).toEqual({
      query: '',
      state: undefined,
    })
  })
})

describe('kindFrom', () => {
  it('knows the four kinds', () => {
    expect(kindFrom('anthropic')).toBe('anthropic')
    expect(kindFrom('azure')).toBeUndefined()
    expect(kindFrom(null)).toBeUndefined()
  })
})

describe('providerCommand', () => {
  it('reads each kind of change', () => {
    expect(parseOptional(providerCommand, { action: 'checkAll' })).toEqual({ action: 'checkAll' })
    expect(
      parseOptional(providerCommand, { action: 'update', id: 2, changes: { enabled: false } }),
    ).toMatchObject({ changes: { enabled: false } })
    expect(
      parseOptional(providerCommand, {
        action: 'addRoutes',
        id: 2,
        items: [{ upstreamId: 'gpt-5', protocol: 'chat' }],
      }),
    ).toMatchObject({ items: [{ upstreamId: 'gpt-5' }] })
  })

  it('refuses an empty list of routes and an unknown kind', () => {
    expect(parseOptional(providerCommand, { action: 'addRoutes', id: 2, items: [] })).toBe(
      undefined,
    )
    expect(
      parseOptional(providerCommand, {
        action: 'create',
        presetId: null,
        name: 'x',
        kind: 'azure',
        baseUrl: '',
        apiKey: 'k',
        priceMultiplier: 1,
      }),
    ).toBeUndefined()
  })
})
