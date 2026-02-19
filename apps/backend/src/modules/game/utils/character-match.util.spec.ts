import { createCharacterMatcher } from './character-match.util'

describe('createCharacterMatcher', () => {
  const finalCharacters = [
    {
      name_jp: '桜子',
      name_en: 'Sakurako',
      aliases: ['Saku', 'Sakurako'],
      id: 1,
    },
    {
      name_en: 'Alice',
      aliases: ['Alicia'],
      id: 2,
    },
    {
      name_en: 'LongNameHeroine',
      aliases: ['Heroine'],
      id: 3,
    },
  ]

  it('matches by normalized exact keys (name/original/aliases)', () => {
    const match = createCharacterMatcher(finalCharacters as any)
    const result = match({
      name: 'Sakurako',
      original: null,
      aliases: [],
    })

    expect(result).toMatchObject({ id: 1 })
  })

  it('falls back to loose contains matching when exact key misses', () => {
    const match = createCharacterMatcher(finalCharacters as any)
    const result = match({
      name: 'namehero',
      original: null,
      aliases: [],
    })

    expect(result).toMatchObject({ id: 3 })
  })

  it('returns undefined when no candidate can be matched', () => {
    const match = createCharacterMatcher(finalCharacters as any)
    const result = match({
      name: 'CompletelyDifferentCharacter',
      original: null,
      aliases: [],
    })

    expect(result).toBeUndefined()
  })
})
