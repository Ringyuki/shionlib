import { describe, expect, it } from 'vitest'
import { firstAddress } from './library'
import { addressFrom, legacyParams } from './library.schema'

const years = [2026, 2025, 2024, 2023]

const read = (search: string, page = 1) => addressFrom(new URLSearchParams(search), page, years)

describe('addressFrom', () => {
  it('starts from the first address', () => {
    expect(read('')).toEqual(firstAddress)
  })

  it('reads every condition, the order and the page', () => {
    expect(
      read(
        'tag=%E7%BA%AF%E7%88%B1&tag=%20school%20&exclude=x&platform=win&platform=and&year=2024&year=2023&month=3&order=asc&resources=any',
        4,
      ),
    ).toEqual({
      tags: ['纯爱', 'school'],
      excluded: ['x'],
      platforms: ['win', 'and'],
      years: [2024, 2023],
      months: [3],
      sort: 'release_date',
      ascending: true,
      resources: 'any',
      page: 4,
    })
  })

  it('drops what it does not know and what is repeated', () => {
    expect(
      read(
        `tag=a&tag=a&tag=&tag=${'t'.repeat(101)}&platform=web&year=1700&year=x&month=13&sort=title&resources=none`,
      ),
    ).toEqual({ ...firstAddress, tags: ['a'] })
  })

  it('keeps months only with a year and a direction only where the sort has two', () => {
    expect(read('month=3&sort=views&order=asc')).toEqual({ ...firstAddress, sort: 'views' })
  })

  it('takes a limited number of values', () => {
    const many = Array.from({ length: 30 }, (_, index) => `tag=t${index}`).join('&')
    expect(read(many).tags).toHaveLength(20)
  })
})

describe('legacyParams', () => {
  it('is nothing for an address in the current form', () => {
    expect(legacyParams(new URLSearchParams('tag=a&page=2'))).toBeUndefined()
  })

  it('renames the filters of the old address and keeps the page', () => {
    const renamed = legacyParams(
      new URLSearchParams(
        'filter%5Btags%5D%5B%5D=a&filter%5Btags%5D%5B%5D=b&filter%5Bexclude_tags%5D%5B%5D=c&filter%5Byears%5D%5B%5D=2024&filter%5Bmonths%5D%5B%5D=3&filter%5Bplatforms%5D%5B%5D=win&filter%5Bsort_by%5D=views&filter%5Bsort_order%5D=desc&page=2',
      ),
    )
    expect(renamed?.toString()).toBe(
      'tag=a&tag=b&exclude=c&year=2024&month=3&platform=win&sort=views&order=desc&page=2',
    )
  })

  it('accepts indexed and scalar forms and ignores filters it does not know', () => {
    const renamed = legacyParams(
      new URLSearchParams('filter[tags][0]=a&filter[tags]=b&filter[start_date]=2024-01-01'),
    )
    expect(renamed?.toString()).toBe('tag=a&tag=b')
  })
})
