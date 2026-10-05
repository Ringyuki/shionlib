import { describe, expect, it } from 'vitest'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'
import type { Schema } from '~/shared/api/types'
import {
  bannerIndex,
  type Platform,
  type ResourceLanguage,
  developerNames,
  gameDescription,
  gameTitle,
  isExplicit,
  originalTitle,
  primaryCover,
  releaseDate,
} from './game'

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

describe('resource labels', () => {
  it('name every platform and language the API accepts in each locale', () => {
    const platforms: Record<Platform, string>[] = [zh.platform, en.platform, ja.platform]
    const languages: Record<ResourceLanguage, string>[] = [zh.language, en.language, ja.language]
    expect(platforms.every(table => Object.values(table).every(label => label !== ''))).toBe(true)
    expect(languages.every(table => Object.values(table).every(label => label !== ''))).toBe(true)
  })
})

describe('display helpers', () => {
  const game = {
    title_jp: 'サクラノ詩',
    title_zh: '樱之诗',
    title_en: '',
    developers: [{ role: '开发', developer: { id: 1, name: '枕', aliases: [] } }],
    release_date: '2015-04-24T00:00:00Z',
  }

  it('shows the original title only when it differs', () => {
    expect(originalTitle(game, 'zh')).toBe('サクラノ詩')
    expect(originalTitle(game, 'ja')).toBeUndefined()
  })

  it('lists developers and parses the release date', () => {
    expect(developerNames(game)).toEqual(['枕'])
    expect(releaseDate(game)?.getUTCFullYear()).toBe(2015)
    expect(releaseDate({ release_date: null })).toBeUndefined()
  })
})

describe('gameDescription', () => {
  it('flattens the preferred intro and caps it for search snippets', () => {
    const intro = { intro_zh: '', intro_jp: '一行目\n二行目', intro_en: 'English' }
    expect(gameDescription(intro, 'zh')).toBe('一行目 二行目')
    expect(gameDescription({ ...intro, intro_jp: '汐'.repeat(400) }, 'ja')).toHaveLength(160)
  })
})

describe('bannerIndex', () => {
  const image = (sexual: number) => ({ url: `${sexual}`, dims: null, sexual, violence: 0 })

  it('picks the first image that is safe to show large', () => {
    expect(bannerIndex([image(1), image(0)], 3)).toBe(1)
    expect(bannerIndex([image(1)], 2)).toBeUndefined()
    expect(bannerIndex([], 0)).toBeUndefined()
  })
})
