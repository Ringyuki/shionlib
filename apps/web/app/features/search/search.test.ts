import { describe, expect, it } from 'vitest'
import {
  byReleaseMonth,
  maxQueryLength,
  maxRecent,
  normalizeQuery,
  releaseWindow,
  rememberSearch,
  resultsSearch,
} from './search'

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

describe('recent releases', () => {
  it('spans last month and this month, across a new year too', () => {
    expect(releaseWindow(new Date('2026-10-07T03:00:00Z'))).toEqual({
      start: '2026-09-01',
      end: '2026-10-31',
      lastMonth: '2026-09',
      thisMonth: '2026-10',
    })
    expect(releaseWindow(new Date('2027-01-15T00:00:00Z'))).toMatchObject({
      start: '2026-12-01',
      end: '2027-01-31',
    })
  })

  it('turns the month over with the site clock', () => {
    expect(releaseWindow(new Date('2026-10-31T16:00:00Z'))).toMatchObject({
      start: '2026-10-01',
      end: '2026-11-30',
      thisMonth: '2026-11',
    })
  })

  it('splits games by the month they are released in', () => {
    const game = (id: number, release_date: string | null) => ({ id, release_date })
    const games = [game(1, '2026-10-31T00:00:00Z'), game(2, '2026-09-01T00:00:00Z'), game(3, null)]
    const months = byReleaseMonth(games, releaseWindow(new Date('2026-10-07T00:00:00Z')))
    expect(months.thisMonth.map(hit => hit.id)).toEqual([1])
    expect(months.lastMonth.map(hit => hit.id)).toEqual([2])
  })
})

describe('results address', () => {
  it('keeps the first page and the default filter out of the URL', () => {
    expect(resultsSearch({ query: '看星星' })).toBe('?q=%E7%9C%8B%E6%98%9F%E6%98%9F')
    expect(resultsSearch({ query: 'a b', page: 1, everyGame: false })).toBe('?q=a+b')
    expect(resultsSearch({ query: 'a', page: 3, everyGame: true })).toBe('?q=a&page=3&all=1')
  })
})
