import { describe, expect, it } from 'vitest'
import { maxQueryLength, maxRecent, normalizeQuery, pageCount, rememberSearch } from './search'

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
})

describe('paging', () => {
  it('counts at least one page', () => {
    expect(pageCount(41, 20)).toBe(3)
    expect(pageCount(0, 20)).toBe(1)
  })
})
