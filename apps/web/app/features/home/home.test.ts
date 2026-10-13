import { describe, expect, it } from 'vitest'
import { monthWindow } from './home'

describe('monthWindow', () => {
  it('spans the whole month of the given moment', () => {
    expect(monthWindow(new Date('2026-10-07T12:00:00Z'))).toEqual({
      month: 10,
      start: '2026-10-01',
      end: '2026-10-31',
    })
  })

  it('ends February on the leap day', () => {
    expect(monthWindow(new Date('2028-02-10T00:00:00Z'))).toMatchObject({
      start: '2028-02-01',
      end: '2028-02-29',
    })
  })

  it('turns the month over with the site clock', () => {
    expect(monthWindow(new Date('2026-12-31T15:59:59Z'))).toEqual({
      month: 12,
      start: '2026-12-01',
      end: '2026-12-31',
    })
    expect(monthWindow(new Date('2026-12-31T16:00:00Z'))).toEqual({
      month: 1,
      start: '2027-01-01',
      end: '2027-01-31',
    })
  })
})
