import { describe, expect, it } from 'vitest'
import {
  developerPath,
  developersPath,
  extrasOf,
  maxQueryLength,
  normalizedQuery,
  websiteOf,
} from './developer'

describe('paths', () => {
  it('addresses the list, a search in it and one developer', () => {
    expect(developersPath('zh')).toBe('/zh/developer')
    expect(developersPath('en', 'Key & Co')).toBe('/en/developer?q=Key+%26+Co')
    expect(developerPath('ja', 5)).toBe('/ja/developer/5')
  })
})

describe('normalizedQuery', () => {
  it('trims what was typed and caps its length', () => {
    expect(normalizedQuery('  まどそふと ')).toBe('まどそふと')
    expect(normalizedQuery(null)).toBe('')
    expect(normalizedQuery('汐'.repeat(maxQueryLength + 5))).toHaveLength(maxQueryLength)
  })
})

describe('details', () => {
  it('has a website only when one is written', () => {
    expect(websiteOf({ website: ' http://key.visualarts.gr.jp/ ' })).toBe(
      'http://key.visualarts.gr.jp/',
    )
    expect(websiteOf({ website: '' })).toBeUndefined()
    expect(websiteOf({ website: null })).toBeUndefined()
  })

  it('keeps the extra facts that say something', () => {
    expect(
      extrasOf({
        extra_info: [
          { key: '设立', value: '2002年' },
          { key: '母公司', value: ' ' },
          { key: '', value: 'WillPlus' },
        ],
      }),
    ).toEqual([{ key: '设立', value: '2002年' }])
    expect(extrasOf({ extra_info: null })).toEqual([])
  })
})
