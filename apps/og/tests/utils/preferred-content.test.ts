import { describe, expect, it } from 'bun:test'
import {
  getGameOgData,
  getCharacterOgData,
  getDeveloperOgData,
  normaliseIntro,
  type GameOgSource,
  type CharacterOgSource,
  type DeveloperOgSource,
} from '../../src/utils/preferred-content'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const fullGame: GameOgSource = {
  title_jp: 'タイトルJP',
  title_zh: '标题ZH',
  title_en: 'Title EN',
  intro_jp: 'イントロJP',
  intro_zh: '简介ZH',
  intro_en: 'Intro EN',
}

// ─── getGameOgData ───────────────────────────────────────────────────────────

describe('getGameOgData', () => {
  it('returns preferred-lang title and intro when available', () => {
    const result = getGameOgData(fullGame, 'zh')
    expect(result.title).toBe('标题ZH')
    expect(result.intro).toBe('简介ZH')
  })

  it('falls back to jp title when preferred lang field is empty', () => {
    const game = { ...fullGame, title_en: '', intro_en: '' }
    const result = getGameOgData(game, 'en')
    expect(result.title).toBe('タイトルJP')
    expect(result.intro).toBe('イントロJP')
  })

  it('falls back through en then zh when jp is also empty', () => {
    const game: GameOgSource = {
      title_jp: '',
      title_zh: '',
      title_en: 'Fallback EN',
      intro_jp: '',
      intro_zh: '',
      intro_en: 'Fallback intro',
    }
    const result = getGameOgData(game, 'jp')
    expect(result.title).toBe('Fallback EN')
  })

  it('selects cover matching the requested language', () => {
    const game: GameOgSource = {
      ...fullGame,
      covers: [
        { language: 'en', url: 'https://img/en.webp', dims: [900, 600] },
        { language: 'zh', url: 'https://img/zh.webp', dims: [600, 900] },
      ],
    }
    const result = getGameOgData(game, 'zh')
    expect(result.coverUrl).toBe('https://img/zh.webp')
  })

  it('falls back to first cover when no cover matches lang', () => {
    const game: GameOgSource = {
      ...fullGame,
      covers: [{ language: 'jp', url: 'https://img/fallback.webp', dims: [800, 533] }],
    }
    const result = getGameOgData(game, 'en')
    expect(result.coverUrl).toBe('https://img/fallback.webp')
  })

  it('returns null coverUrl when covers is absent', () => {
    const result = getGameOgData(fullGame, 'en')
    expect(result.coverUrl).toBeNull()
    expect(result.aspectRatio).toBe('3:2') // default when no cover
  })

  it('computes 3:2 aspect ratio for landscape covers', () => {
    const game: GameOgSource = {
      ...fullGame,
      covers: [{ language: 'en', url: '/img.webp', dims: [900, 600] }],
    }
    expect(getGameOgData(game, 'en').aspectRatio).toBe('3:2')
  })

  it('computes 2:3 aspect ratio for portrait covers', () => {
    const game: GameOgSource = {
      ...fullGame,
      covers: [{ language: 'jp', url: '/img.webp', dims: [600, 900] }],
    }
    expect(getGameOgData(game, 'jp').aspectRatio).toBe('2:3')
  })

  it('computes 1:1 aspect ratio for near-square covers', () => {
    const game: GameOgSource = {
      ...fullGame,
      covers: [{ language: 'jp', url: '/img.webp', dims: [500, 480] }],
    }
    expect(getGameOgData(game, 'jp').aspectRatio).toBe('1:1')
  })
})

// ─── getCharacterOgData ──────────────────────────────────────────────────────

describe('getCharacterOgData', () => {
  it('returns preferred-lang name and intro', () => {
    const character: CharacterOgSource = {
      name_jp: '名前JP',
      name_zh: '名字ZH',
      intro_zh: '简介ZH',
      image: '/char.webp',
    }
    const result = getCharacterOgData(character, 'zh')
    expect(result.name).toBe('名字ZH')
    expect(result.intro).toBe('简介ZH')
    expect(result.imageUrl).toBe('/char.webp')
  })

  it('falls back to jp name when preferred lang name is absent', () => {
    const character: CharacterOgSource = { name_jp: '名前JP', name_en: '' }
    const result = getCharacterOgData(character, 'en')
    expect(result.name).toBe('名前JP')
  })

  it('returns empty string for intro when all intro fields are absent', () => {
    const result = getCharacterOgData({ name_jp: '名前' }, 'jp')
    expect(result.intro).toBe('')
  })

  it('returns null imageUrl when image is absent', () => {
    const result = getCharacterOgData({ name_jp: '名前' }, 'jp')
    expect(result.imageUrl).toBeNull()
  })
})

// ─── getDeveloperOgData ──────────────────────────────────────────────────────

describe('getDeveloperOgData', () => {
  const baseDev: DeveloperOgSource = {
    name: 'Key Software',
    aliases: ['KS'],
    intro_jp: 'イントロ',
    intro_zh: '简介',
    intro_en: 'Intro',
  }

  it('uses preferred-lang intro', () => {
    expect(getDeveloperOgData(baseDev, 'zh').intro).toBe('简介')
    expect(getDeveloperOgData(baseDev, 'en').intro).toBe('Intro')
  })

  it('falls back to jp intro when preferred lang is empty', () => {
    const dev = { ...baseDev, intro_en: '' }
    expect(getDeveloperOgData(dev, 'en').intro).toBe('イントロ')
  })

  it('uses the first alias when name is empty', () => {
    const dev = { ...baseDev, name: '' }
    expect(getDeveloperOgData(dev, 'jp').name).toBe('KS')
  })

  it('returns null logoUrl when logo is absent', () => {
    expect(getDeveloperOgData(baseDev, 'jp').logoUrl).toBeNull()
  })

  it('returns logoUrl when logo is present', () => {
    const dev = { ...baseDev, logo: '/logo.png' }
    expect(getDeveloperOgData(dev, 'jp').logoUrl).toBe('/logo.png')
  })
})

// ─── normaliseIntro ──────────────────────────────────────────────────────────

describe('normaliseIntro', () => {
  it('collapses \\n to spaces', () => {
    expect(normaliseIntro('line1\nline2')).toBe('line1 line2')
  })

  it('collapses \\r\\n to a single space', () => {
    expect(normaliseIntro('a\r\nb')).toBe('a b')
  })

  it('collapses multiple consecutive newlines to a single space', () => {
    expect(normaliseIntro('a\n\n\nb')).toBe('a b')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normaliseIntro('  hello  ')).toBe('hello')
  })

  it('returns text unchanged when within maxLength', () => {
    const short = 'short'
    expect(normaliseIntro(short, 100)).toBe(short)
  })

  it('uses 600 as the default maxLength', () => {
    const long = 'b'.repeat(1000)
    const result = normaliseIntro(long)
    expect(result.length).toBe(600)
  })
})
