import { describe, expect, it } from 'vitest'
import en from './messages/en.json'
import ja from './messages/ja.json'
import zh from './messages/zh.json'
import {
  cleanName,
  homepageOf,
  maxNameLength,
  maxQueryLength,
  nameKey,
  normalizedQuery,
  translatorChoices,
  translatorPath,
  translatorsPath,
  type TranslatorItem,
} from './translator'

const tea: TranslatorItem = { id: 1, name: '绿茶汉化组', aliases: ['Green Tea'], works_count: 58 }

const panda: TranslatorItem = { id: 2, name: '熊喵守护协会', aliases: null, works_count: 2 }

describe('paths', () => {
  it('addresses the list, a search in it and one translator', () => {
    expect(translatorsPath('zh')).toBe('/zh/translator')
    expect(translatorsPath('en', 'Can/need')).toBe('/en/translator?q=Can%2Fneed')
    expect(translatorPath('ja', 5)).toBe('/ja/translator/5')
  })
})

describe('normalizedQuery', () => {
  it('trims what was typed and caps its length', () => {
    expect(normalizedQuery('  绿茶 ')).toBe('绿茶')
    expect(normalizedQuery(null)).toBe('')
    expect(normalizedQuery('汐'.repeat(maxQueryLength + 5))).toHaveLength(maxQueryLength)
  })
})

describe('homepageOf', () => {
  it('has a homepage only when one is written', () => {
    expect(homepageOf({ homepage: ' https://example.org/ ' })).toBe('https://example.org/')
    expect(homepageOf({ homepage: '' })).toBeUndefined()
    expect(homepageOf({ homepage: null })).toBeUndefined()
  })
})

describe('names', () => {
  it('cleans the spaces of a typed name', () => {
    expect(cleanName('  Can/need   汉化组 ')).toBe('Can/need 汉化组')
    expect(cleanName('   ')).toBe('')
  })

  it('compares names without regard to width and case', () => {
    expect(nameKey('Ｃａｎ／Ｎｅｅｄ汉化组')).toBe(nameKey('can/need汉化组'))
    expect(nameKey('绿茶汉化组')).not.toBe(nameKey('绿洲汉化组'))
  })
})

describe('translatorChoices', () => {
  it('offers what was found and a new translator under the typed name', () => {
    expect(translatorChoices([panda], ' 熊喵 ', ['绿茶汉化组'])).toEqual([
      { value: '熊喵守护协会', label: '熊喵守护协会', works: 2, fresh: false },
      { value: '熊喵', label: '熊喵', works: 0, fresh: true },
    ])
  })

  it('offers nothing new for a name or alias that exists or is already chosen', () => {
    const fresh = (typed: string, chosen: string[] = []) =>
      translatorChoices([tea, panda], typed, chosen).filter(choice => choice.fresh)
    expect(fresh('绿茶汉化组')).toEqual([])
    expect(fresh('green tea')).toEqual([])
    expect(fresh('新组', ['新组'])).toEqual([])
    expect(fresh('')).toEqual([])
    expect(fresh('汐'.repeat(maxNameLength + 1))).toEqual([])
  })

  it('keeps the chosen spelling of a found translator so it shows as chosen', () => {
    const [choice] = translatorChoices([tea], '', ['绿茶汉化组'])
    expect(choice).toMatchObject({ value: '绿茶汉化组', fresh: false })
  })
})

describe('messages', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(en)).toEqual(Object.keys(zh))
    expect(Object.keys(ja)).toEqual(Object.keys(zh))
  })
})
