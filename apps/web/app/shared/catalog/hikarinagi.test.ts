import { describe, expect, it } from 'vitest'
import { hikarinagiEditUrl, hikarinagiEntryUrl } from './hikarinagi'

describe('Hikarinagi links', () => {
  it('points at the entry and its editor', () => {
    expect(hikarinagiEntryUrl('https://www.hikarinagi.org', 'galgame', 13)).toBe(
      'https://www.hikarinagi.org/galgames/13',
    )
    expect(hikarinagiEntryUrl('https://www.hikarinagi.org', 'producer', 2)).toBe(
      'https://www.hikarinagi.org/producers/2',
    )
    expect(hikarinagiEditUrl('https://www.hikarinagi.org', 'character', 5)).toBe(
      'https://www.hikarinagi.org/create/edit/character/5',
    )
  })
})
