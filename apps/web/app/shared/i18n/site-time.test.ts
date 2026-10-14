import { describe, expect, it } from 'vitest'
import { isoDate, siteDay, siteInstant, siteMinute, siteMonthStart } from './site-time'

describe('siteMonthStart', () => {
  it('reads the month from the site clock, not from UTC', () => {
    expect(isoDate(siteMonthStart(new Date('2026-10-31T15:59:59Z')))).toBe('2026-10-01')
    expect(isoDate(siteMonthStart(new Date('2026-10-31T16:00:00Z')))).toBe('2026-11-01')
  })

  it('moves into the next year with the site clock', () => {
    expect(isoDate(siteMonthStart(new Date('2026-12-31T20:00:00Z')))).toBe('2027-01-01')
  })
})

describe('siteDay', () => {
  it('is the calendar day on the site clock', () => {
    expect(siteDay(new Date('2025-04-25T00:00:00Z'))).toBe('2025-04-25')
    expect(siteDay(new Date('2025-04-24T16:00:00Z'))).toBe('2025-04-25')
    expect(siteDay(new Date('2025-12-31T16:00:00Z'))).toBe('2026-01-01')
  })
})

describe('siteMinute', () => {
  it('is the minute on the site clock, in the form date and time fields take', () => {
    expect(siteMinute(new Date('2026-10-14T16:05:59Z'))).toBe('2026-10-15T00:05')
    expect(siteMinute(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14T11:00')
  })
})

describe('siteInstant', () => {
  it('reads a minute on the site clock back as the same instant', () => {
    const instant = siteInstant('2026-10-15T00:05')
    expect(instant).toBe('2026-10-15T00:05:00+08:00')
    expect(new Date(instant).toISOString()).toBe('2026-10-14T16:05:00.000Z')
    expect(siteMinute(new Date(instant))).toBe('2026-10-15T00:05')
  })
})
