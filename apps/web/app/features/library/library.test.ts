import { describe, expect, it } from 'vitest'
import { sortedGamesPath, tagPath } from '~/features/game'
import {
  conditionsOf,
  firstAddress,
  libraryPath,
  librarySearch,
  listQuery,
  narrowedToResources,
  withResourcesOnly,
  withoutConditions,
  yearOptions,
  type LibraryAddress,
} from './library'

const address = (changes: Partial<LibraryAddress> = {}): LibraryAddress => ({
  ...firstAddress,
  ...changes,
})

describe('yearOptions', () => {
  it('lists the years from next year back to the first one, by the site clock', () => {
    const years = yearOptions(new Date('2026-12-31T16:30:00Z'))
    expect(years.slice(0, 3)).toEqual([2028, 2027, 2026])
    expect(years.at(-1)).toBe(1980)
  })
})

describe('librarySearch', () => {
  it('is empty for the first address', () => {
    expect(librarySearch(address())).toBe('')
  })

  it('writes every condition, the order and the page', () => {
    const search = librarySearch(
      address({
        tags: ['纯爱', 'a b'],
        excluded: ['拔作'],
        platforms: ['win', 'and'],
        years: [2024, 2023],
        months: [3],
        sort: 'release_date',
        ascending: true,
        resources: 'any',
        page: 2,
      }),
    )
    expect(search).toBe(
      '?tag=%E7%BA%AF%E7%88%B1&tag=a+b&exclude=%E6%8B%94%E4%BD%9C&platform=win&platform=and&year=2024&year=2023&month=3&order=asc&resources=any&page=2',
    )
  })

  it('leaves out months without a year and a direction the sort does not have', () => {
    expect(librarySearch(address({ months: [3], sort: 'views', ascending: true }))).toBe(
      '?sort=views',
    )
  })
})

describe('libraryPath', () => {
  it('is where the links of other features lead', () => {
    expect(libraryPath('zh')).toBe('/zh/game')
    expect(libraryPath('ja', { tags: ['纯爱'] })).toBe(tagPath('ja', '纯爱'))
    expect(libraryPath('en', { sort: 'resource_updated' })).toBe(
      sortedGamesPath('en', 'resource_updated'),
    )
  })
})

describe('listQuery', () => {
  it('asks for one page with the conditions of the address', () => {
    expect(
      listQuery(
        address({ tags: ['a'], excluded: ['b'], platforms: ['win'], years: [2024], months: [3] }),
      ),
    ).toEqual({
      page: 1,
      pageSize: 36,
      'filter[tags][]': ['a'],
      'filter[exclude_tags][]': ['b'],
      'filter[platforms][]': ['win'],
      'filter[years][]': [2024],
      'filter[months][]': [3],
      'filter[sort_by]': 'release_date',
      'filter[sort_order]': 'desc',
      resources: undefined,
    })
  })

  it('never asks for months of the current year alone', () => {
    expect(listQuery(address({ months: [3] }))['filter[months][]']).toEqual([])
  })
})

describe('resources', () => {
  it('follows the viewer unless the address says otherwise', () => {
    expect(narrowedToResources(address(), true)).toBe(true)
    expect(narrowedToResources(address(), false)).toBe(false)
    expect(narrowedToResources(address({ resources: 'any' }), true)).toBe(false)
    expect(narrowedToResources(address({ resources: 'required' }), false)).toBe(true)
  })

  it('is always narrowed when sorted by resource updates', () => {
    expect(
      narrowedToResources(address({ sort: 'resource_updated', resources: 'any' }), false),
    ).toBe(true)
  })

  it('writes the rule only when it differs from the viewer setting', () => {
    expect(withResourcesOnly(true, true)).toEqual({ resources: undefined })
    expect(withResourcesOnly(false, true)).toEqual({ resources: 'any' })
    expect(withResourcesOnly(true, false)).toEqual({ resources: 'required' })
  })
})

describe('conditionsOf', () => {
  it('lists every condition with the change that removes it', () => {
    const conditions = conditionsOf(
      address({
        tags: ['a', 'b'],
        excluded: ['c'],
        platforms: ['win'],
        years: [2024],
        months: [3],
        resources: 'any',
      }),
      true,
    )
    expect(conditions.map(({ kind, value }) => `${kind}:${value}`)).toEqual([
      'tag:a',
      'tag:b',
      'excluded:c',
      'platform:win',
      'year:2024',
      'month:3',
      'resources:any',
    ])
    expect(conditions[0]?.without).toEqual({ tags: ['b'] })
    expect(conditions.at(-1)?.without).toEqual({ resources: undefined })
  })

  it('does not count a rule that repeats the viewer setting or that the sort overrides', () => {
    expect(conditionsOf(address({ resources: 'required' }), true)).toEqual([])
    expect(conditionsOf(address({ resources: 'any', sort: 'resource_updated' }), true)).toEqual([])
    expect(conditionsOf(address({ months: [3] }), true)).toEqual([])
  })
})

describe('withoutConditions', () => {
  it('keeps only the order', () => {
    expect(
      withoutConditions(address({ tags: ['a'], sort: 'views', resources: 'any', page: 3 })),
    ).toEqual(address({ sort: 'views' }))
  })
})
