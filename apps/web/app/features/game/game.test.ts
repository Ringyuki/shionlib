import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { gameTitle, isExplicit, primaryCover } from './game'

const cover = (type: Schema<'GameCoverDTO'>['type'], url: string): Schema<'GameCoverDTO'> => ({
  dims: null,
  language: 'jp',
  sexual: 0,
  type,
  url,
  violence: 0,
})

describe('gameTitle', () => {
  it('uses the title of the requested locale', () => {
    expect(gameTitle({ title_zh: '樱花', title_jp: 'さくら', title_en: 'Sakura' }, 'en')).toBe(
      'Sakura',
    )
  })

  it('falls back when the locale has no title', () => {
    expect(gameTitle({ title_zh: ' ', title_jp: 'さくら', title_en: 'Sakura' }, 'zh')).toBe(
      'さくら',
    )
  })
})

describe('primaryCover', () => {
  it('prefers the package front', () => {
    expect(primaryCover({ covers: [cover('dig', 'a'), cover('pkgfront', 'b')] })?.url).toBe('b')
  })

  it('handles games without covers', () => {
    expect(primaryCover({ covers: null })).toBeUndefined()
  })
})

describe('isExplicit', () => {
  it('flags sexual or violent covers', () => {
    expect(isExplicit({ ...cover('pkgfront', 'a'), sexual: 1 })).toBe(true)
    expect(isExplicit(cover('pkgfront', 'a'))).toBe(false)
  })
})
