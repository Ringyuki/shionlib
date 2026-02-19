import { applyDate } from './date-filters'

describe('applyDate', () => {
  it('returns a shallow copy when no valid year/month filter is provided', () => {
    const where = { nsfw: false }

    const out = applyDate(where, { years: [Number.NaN], months: [0, 13] })

    expect(out).toEqual(where)
    expect(out).not.toBe(where)
  })

  it('builds year-month cross product with sorted unique inputs', () => {
    const out = applyDate({ type: 'galgame' } as any, {
      years: [2024, 2023, 2024],
      months: [2, 1, 2, 99 as any],
    }) as any

    expect(out.AND[0]).toEqual({ type: 'galgame' })
    expect(out.AND[1].OR).toHaveLength(4)
    expect(out.AND[1].OR[0].release_date.gte.toISOString()).toBe('2023-01-01T00:00:00.000Z')
    expect(out.AND[1].OR[0].release_date.lt.toISOString()).toBe('2023-02-01T00:00:00.000Z')
    expect(out.AND[1].OR[3].release_date.gte.toISOString()).toBe('2024-02-01T00:00:00.000Z')
    expect(out.AND[1].OR[3].release_date.lt.toISOString()).toBe('2024-03-01T00:00:00.000Z')
  })

  it('uses current UTC year when only month filter is provided', () => {
    const year = new Date().getUTCFullYear()
    const out = applyDate({}, { months: [12] }) as any

    expect(out.AND[1].OR).toHaveLength(1)
    expect(out.AND[1].OR[0].release_date.gte.toISOString()).toBe(`${year}-12-01T00:00:00.000Z`)
    expect(out.AND[1].OR[0].release_date.lt.toISOString()).toBe(`${year + 1}-01-01T00:00:00.000Z`)
  })
})
