import { dedupeCharactersInPlace, dedupeDevelopersInPlace } from './dedupe'

describe('dedupe helpers', () => {
  it('dedupeCharactersInPlace merges by v_id and fallback normalized name', () => {
    const input: any[] = [
      {
        v_id: 'v-1',
        name_jp: 'JP Name',
        aliases: ['a'],
        gender: ['f'],
      },
      {
        v_id: 'v-1',
        name_en: 'EN Name',
        aliases: ['a', 'b'],
        image: 'cover.png',
      },
      {
        name_en: 'B eta',
        aliases: ['x'],
      },
      {
        name_en: 'beta',
        aliases: ['y'],
      },
    ]

    dedupeCharactersInPlace(input)

    expect(input).toHaveLength(2)
    expect(input[0]).toMatchObject({
      v_id: 'v-1',
      name_jp: 'JP Name',
      name_en: 'EN Name',
      image: 'cover.png',
      gender: ['f'],
    })
    expect(input[0].aliases).toEqual(['a', 'b'])
    expect(input[1].aliases).toEqual(['x', 'y'])
  })

  it('dedupeDevelopersInPlace merges by ids and keeps first non-empty scalar', () => {
    const input: any[] = [
      {
        b_id: 'b-1',
        name: 'Studio A',
        aliases: ['old'],
        intro_jp: 'jp',
      },
      {
        b_id: 'b-1',
        name: 'Studio A',
        aliases: ['new'],
        intro_zh: 'zh',
      },
      {
        name: ' Studio   B ',
      },
      {
        name: 'studio b',
        logo: 'logo.png',
      },
    ]

    dedupeDevelopersInPlace(input)

    expect(input).toHaveLength(2)
    expect(input[0]).toMatchObject({
      b_id: 'b-1',
      name: 'Studio A',
      intro_jp: 'jp',
      intro_zh: 'zh',
    })
    expect(input[0].aliases).toEqual(['old', 'new'])
    expect(input[1]).toMatchObject({
      name: ' Studio   B ',
      logo: 'logo.png',
    })
  })
})
