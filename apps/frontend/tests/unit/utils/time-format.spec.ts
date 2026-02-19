import { afterEach, describe, expect, it, vi } from 'vitest'
import { timeFormat, timeFromNow, TimeFormatEnum } from '../../../utils/time-format'

describe('utils/time-format (unit)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats time with provided pattern and locale', () => {
    const localDate = new Date(2026, 0, 2, 12, 34, 56)
    expect(timeFormat(localDate, 'en', TimeFormatEnum.YYYY_MM_DD)).toBe('2026-01-02')
    expect(timeFormat(localDate, 'en', TimeFormatEnum.HH_MM_SS)).toBe('12:34:56')
  })

  it('returns human readable relative time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0))
    expect(timeFromNow(new Date(2026, 0, 2, 11, 59, 0), 'en')).toContain('ago')
  })

  it('returns empty string for empty date', () => {
    expect(timeFromNow('' as unknown as Date, 'en')).toBe('')
  })
})
