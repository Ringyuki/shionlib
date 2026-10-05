import { describe, expect, it } from 'vitest'
import { characterName } from './character'

const character = { name_jp: '御桜稟', name_zh: '御樱禀', name_en: null }

describe('characterName', () => {
  it('uses the localized name when there is one', () => {
    expect(characterName(character, 'zh')).toBe('御樱禀')
    expect(characterName(character, 'en')).toBe('御桜稟')
    expect(characterName(character, 'ja')).toBe('御桜稟')
  })
})
