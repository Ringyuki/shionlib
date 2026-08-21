import { releasePeriods } from './date-filters'

describe('releasePeriods', () => {
  it('ignores invalid years and months', () => {
    expect(releasePeriods({ years: [Number.NaN], months: [0, 13] })).toBeUndefined()
  })

  it('returns undefined when nothing is selected', () => {
    expect(releasePeriods()).toBeUndefined()
    expect(releasePeriods({ years: [], months: [] })).toBeUndefined()
  })

  it('expands the cartesian product of years and months', () => {
    expect(releasePeriods({ years: [2021, 2020], months: [3, 1] })).toEqual([
      '2020-01',
      '2020-03',
      '2021-01',
      '2021-03',
    ])
  })

  it('returns bare years when no month is selected', () => {
    expect(releasePeriods({ years: [2020, 2020, 2019] })).toEqual(['2019', '2020'])
  })

  it('falls back to the current year when only months are selected', () => {
    const year = new Date().getUTCFullYear()
    expect(releasePeriods({ months: [12] })).toEqual([`${year}-12`])
  })
})
