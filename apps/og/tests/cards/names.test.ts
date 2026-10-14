import { describe, expect, it } from 'bun:test'
import {
  characterName,
  gameTitle,
  joined,
  originalName,
  originalTitle,
} from '../../src/cards/names'

const game = {
  title_zh: '橘光柠水随想曲',
  title_jp: 'ライムライト・レモネードジャム',
  title_en: '',
}

describe('game titles', () => {
  it('reads the title in the order of the page language', () => {
    expect(gameTitle(game, 'zh')).toBe('橘光柠水随想曲')
    expect(gameTitle(game, 'en')).toBe('ライムライト・レモネードジャム')
    expect(gameTitle(game, 'ja')).toBe('ライムライト・レモネードジャム')
  })

  it('adds the original title only when it differs from the shown one', () => {
    expect(originalTitle(game, 'zh')).toBe('ライムライト・レモネードジャム')
    expect(originalTitle(game, 'ja')).toBeUndefined()
  })
})

describe('character names', () => {
  const character = { name_jp: 'ムラサメ', name_zh: '丛雨', name_en: 'Murasame' }

  it('uses the localized name with the Japanese one beside it', () => {
    expect(characterName(character, 'zh')).toBe('丛雨')
    expect(originalName(character, 'zh')).toBe('ムラサメ')
    expect(characterName(character, 'ja')).toBe('ムラサメ')
    expect(originalName(character, 'ja')).toBeUndefined()
  })

  it('falls back to the Japanese name', () => {
    expect(characterName({ ...character, name_zh: ' ' }, 'zh')).toBe('ムラサメ')
  })
})

describe('joined', () => {
  it('skips missing parts', () => {
    expect(joined(['ゆずソフト', undefined, '', '2025年9月26日'])).toBe(
      'ゆずソフト · 2025年9月26日',
    )
  })
})
