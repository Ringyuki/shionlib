import { describe, expect, it } from 'bun:test'
import { coverOf } from '../../src/cards/covers'
import type { Cover } from '../../src/services/catalog'

const cover = (overrides: Partial<Cover>): Cover => ({
  type: 'dig',
  url: 'https://images.example/a.webp',
  dims: [500, 700],
  sexual: 0,
  violence: 0,
  masked: false,
  ...overrides,
})

describe('coverOf', () => {
  it('prefers the package front over the first cover', () => {
    const chosen = coverOf([cover({ url: 'first' }), cover({ type: 'pkgfront', url: 'front' })])
    expect(chosen?.src).toBe('front')
  })

  it('never shows a rated cover that the API did not mask', () => {
    expect(coverOf([cover({ sexual: 1 })])).toBeUndefined()
    expect(coverOf([cover({ violence: 2 }), cover({ url: 'safe' })])?.src).toBe('safe')
  })

  it('shows a masked cover and says so', () => {
    expect(coverOf([cover({ sexual: 2, masked: true, url: 'blurred' })])).toEqual({
      src: 'blurred',
      dims: [500, 700],
      masked: true,
    })
  })
})
