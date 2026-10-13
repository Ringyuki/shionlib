import { describe, expect, it } from 'vitest'
import {
  appearanceIn,
  birthdayOf,
  characterName,
  characterPath,
  gendersOf,
  groupCast,
  measurementsOf,
  otherNames,
  voiceOf,
  type CastCredit,
} from './character'

const character = { name_jp: '御桜稟', name_zh: '御樱禀', name_en: null }

const credit = (id: number, role: CastCredit['role']): CastCredit => ({
  role,
  actor: null,
  image: null,
  character: {
    id,
    name_jp: `キャラ${id}`,
    name_zh: '',
    name_en: '',
    image: null,
    intro_jp: '',
    intro_zh: '',
    intro_en: '',
    aliases: null,
    gender: null,
    blood_type: null,
    height: null,
    weight: null,
    bust: null,
    waist: null,
    hips: null,
    cup: null,
    age: null,
    birthday: null,
  },
})

describe('characterName', () => {
  it('uses the localized name when there is one', () => {
    expect(characterName(character, 'zh')).toBe('御樱禀')
    expect(characterName(character, 'en')).toBe('御桜稟')
    expect(characterName(character, 'ja')).toBe('御桜稟')
  })
})

describe('otherNames', () => {
  it('lists the names in the other languages once, without the one that is shown', () => {
    const named = { name_jp: '鳴瀬しろは', name_zh: '鸣濑白羽', name_en: 'Naruse Shiroha' }
    expect(otherNames(named, 'zh')).toEqual(['鳴瀬しろは', 'Naruse Shiroha'])
    expect(otherNames(named, 'ja')).toEqual(['鸣濑白羽', 'Naruse Shiroha'])
    expect(otherNames({ name_jp: 'Key', name_zh: ' ', name_en: 'Key' }, 'en')).toEqual([])
  })
})

describe('characterPath', () => {
  it('addresses a character in the language of the page', () => {
    expect(characterPath('ja', 68)).toBe('/ja/character/68')
  })
})

describe('groupCast', () => {
  it('orders the credits of a game by role and leaves empty roles out', () => {
    const groups = groupCast([credit(1, 'side'), credit(2, 'main'), credit(3, 'side')])
    expect(groups.map(group => [group.role, group.credits.map(one => one.character.id)])).toEqual([
      ['main', [2]],
      ['side', [1, 3]],
    ])
  })
})

describe('appearances', () => {
  const appearances = [
    { game_id: 3, role: 'main', actor: ' 小原好美 ' },
    { game_id: 8, role: 'side', actor: '' },
  ] as const

  it('finds the part a character plays in a game', () => {
    expect(appearanceIn({ appearances: [...appearances] }, 8)?.role).toBe('side')
    expect(appearanceIn({ appearances: [...appearances] }, 9)).toBeUndefined()
    expect(appearanceIn({ appearances: null }, 3)).toBeUndefined()
  })

  it('names the voice only when one is written', () => {
    expect(voiceOf(appearances[0])).toBe('小原好美')
    expect(voiceOf(appearances[1])).toBeUndefined()
    expect(voiceOf({ actor: null })).toBeUndefined()
  })
})

describe('facts', () => {
  it('names each gender once and drops blanks', () => {
    expect(gendersOf({ gender: ['f', 'f', ''] })).toEqual(['f'])
    expect(gendersOf({ gender: null })).toEqual([])
  })

  it('reads a birthday as a month and a day, including 29 February', () => {
    expect(birthdayOf({ birthday: [6, 8] })?.toISOString()).toBe('2000-06-08T00:00:00.000Z')
    expect(birthdayOf({ birthday: [2, 29] })?.toISOString()).toBe('2000-02-29T00:00:00.000Z')
  })

  it('has no birthday when the day is missing or impossible', () => {
    expect(birthdayOf({ birthday: [] })).toBeUndefined()
    expect(birthdayOf({ birthday: null })).toBeUndefined()
    expect(birthdayOf({ birthday: [6] })).toBeUndefined()
    expect(birthdayOf({ birthday: [2, 30] })).toBeUndefined()
    expect(birthdayOf({ birthday: [13, 1] })).toBeUndefined()
  })

  it('writes the measurements that are known', () => {
    expect(measurementsOf({ bust: 81, waist: 56, hips: 83 })).toEqual([
      { part: 'B', size: 81 },
      { part: 'W', size: 56 },
      { part: 'H', size: 83 },
    ])
    expect(measurementsOf({ bust: null, waist: 56, hips: null })).toEqual([{ part: 'W', size: 56 }])
    expect(measurementsOf({ bust: null, waist: null, hips: null })).toEqual([])
  })
})
