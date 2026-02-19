import { describe, expect, it } from 'vitest'
import { parseGameQueryString, parseGameSearchParams } from '../../../../libs/game/useGameList'
import { SortBy, SortOrder } from '../../../../components/game/filter/enums/Sort.enum'

describe('libs/game/useGameList (unit)', () => {
  it('parses query string into normalized filter and page', () => {
    const { filter, page } = parseGameQueryString(
      'filter[tags]=tag-a&filter[years]=2024&filter[months]=3&filter[sort_by]=views&filter[sort_order]=asc&page=2',
    )

    expect(page).toBe(2)
    expect(filter).toEqual({
      tags: ['tag-a'],
      years: [2024],
      months: [3],
      sort_by: SortBy.VIEWS,
      sort_order: SortOrder.ASC,
    })
  })

  it('falls back to defaults for invalid page and missing filter values', () => {
    const { filter, page } = parseGameQueryString('page=invalid')

    expect(page).toBe(1)
    expect(filter.sort_by).toBe(SortBy.RELEASE_DATE)
    expect(filter.sort_order).toBe(SortOrder.DESC)
    expect(filter.tags).toEqual([])
    expect(filter.years).toEqual([])
    expect(filter.months).toEqual([])
  })

  it('parses search params object with array values', () => {
    const { filter, page } = parseGameSearchParams({
      'filter[tags]': ['tag-a', 'tag-b'],
      'filter[years]': ['2023', 'bad'],
      page: '3',
    } as any)

    expect(page).toBe(3)
    expect(filter.tags).toEqual(['tag-a', 'tag-b'])
    expect(filter.years).toEqual([2023])
  })
})
