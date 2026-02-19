import { describe, expect, it } from 'vitest'
import { friendLinks } from '../../../config/friend-links/links'

describe('config/friend-links/links (unit)', () => {
  it('contains valid friend links with unique ids', () => {
    expect(friendLinks.length).toBeGreaterThan(0)
    const ids = friendLinks.map(link => link.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const link of friendLinks) {
      expect(link.name.length).toBeGreaterThan(0)
      expect(link.url.startsWith('http')).toBe(true)
      expect(link.logo.startsWith('http')).toBe(true)
      expect(link.description.length).toBeGreaterThan(0)
    }
  })
})
