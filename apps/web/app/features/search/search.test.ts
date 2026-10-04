import { describe, expect, it } from 'vitest'
import {
  characterName,
  maxQueryLength,
  maxRecent,
  normalizeQuery,
  pageCount,
  pageParam,
  parseRecent,
  rememberSearch,
  type CharacterHit,
} from './search'

const character: CharacterHit = {
  id: 1,
  image: null,
  name_jp: '御桜稟',
  name_zh: '御樱禀',
  name_en: null,
  aliases: [],
  game: null,
}

describe('normalizeQuery', () => {
  it('collapses whitespace and caps the length', () => {
    expect(normalizeQuery('  サクラノ   詩 ')).toBe('サクラノ 詩')
    expect(normalizeQuery(null)).toBe('')
    expect([...normalizeQuery('汐'.repeat(maxQueryLength + 5))]).toHaveLength(maxQueryLength)
  })
})

describe('recent searches', () => {
  it('keeps the newest first without case-insensitive duplicates', () => {
    expect(rememberSearch(['Sakura', 'senren'], ' sakura ')).toEqual(['sakura', 'senren'])
    expect(rememberSearch(['a'], '  ')).toEqual(['a'])
    const many = Array.from({ length: maxRecent }, (_, index) => `q${index}`)
    expect(rememberSearch(many, 'new')).toHaveLength(maxRecent)
  })

  it('reads only well-formed stored lists', () => {
    expect(parseRecent('["a", 1, " b "]')).toEqual(['a', 'b'])
    expect(parseRecent('{')).toEqual([])
    expect(parseRecent('"a"')).toEqual([])
    expect(parseRecent(null)).toEqual([])
  })
})

describe('paging', () => {
  it('parses positive pages and counts at least one page', () => {
    expect(pageParam('3')).toBe(3)
    expect(pageParam('0')).toBe(1)
    expect(pageParam('x')).toBe(1)
    expect(pageCount(41, 20)).toBe(3)
    expect(pageCount(0, 20)).toBe(1)
  })
})

describe('characterName', () => {
  it('uses the localized name when there is one', () => {
    expect(characterName(character, 'zh')).toBe('御樱禀')
    expect(characterName(character, 'en')).toBe('御桜稟')
    expect(characterName(character, 'ja')).toBe('御桜稟')
  })
})
