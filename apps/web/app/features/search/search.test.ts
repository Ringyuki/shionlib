import { describe, expect, it } from 'vitest'
import {
  byReleaseMonth,
  maxQueryLength,
  maxRecent,
  normalizeQuery,
  pageCount,
  releaseWindow,
  rememberSearch,
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

describe('paging', () => {
  it('counts at least one page', () => {
    expect(pageCount(41, 20)).toBe(3)
    expect(pageCount(0, 20)).toBe(1)
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

  it('splits games by the month they are released in', () => {
    const game = (id: number, release_date: string | null) => ({ id, release_date })
    const games = [game(1, '2026-10-31T00:00:00Z'), game(2, '2026-09-01T00:00:00Z'), game(3, null)]
    const months = byReleaseMonth(games, releaseWindow(new Date('2026-10-07T00:00:00Z')))
    expect(months.thisMonth.map(hit => hit.id)).toEqual([1])
    expect(months.lastMonth.map(hit => hit.id)).toEqual([2])
  })
})
