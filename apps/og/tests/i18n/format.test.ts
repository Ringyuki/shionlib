import { describe, expect, it } from 'bun:test'
import { formatBytes, formatCalendarDay, formatNumber, formatSiteDay } from '../../src/i18n/format'
import { labelsOf } from '../../src/i18n/messages'

describe('format', () => {
  it('writes sizes the way the site does', () => {
    expect(formatBytes('zh', 9205871997)).toBe('8.57 GB')
    expect(formatBytes('en', 512)).toBe('512 B')
  })

  it('writes a release day as the calendar day it is stored as', () => {
    expect(formatCalendarDay('zh', '2025-09-26T00:00:00.000Z')).toBe('2025年9月26日')
    expect(formatCalendarDay('en', '2025-09-26T00:00:00.000Z')).toBe('September 26, 2025')
    expect(formatCalendarDay('ja', 'not a date')).toBe('')
  })

  it('writes a moment as the day it is at the site', () => {
    expect(formatSiteDay('zh', '2026-05-04T20:36:05.560Z')).toBe('2026年5月5日')
  })

  it('groups digits', () => {
    expect(formatNumber('zh', 3444)).toBe('3,444')
  })
})

describe('labels', () => {
  it('counts in each language', () => {
    expect(labelsOf('zh').resources(2)).toBe('2 个资源')
    expect(labelsOf('en').resources(1)).toBe('1 resource')
    expect(labelsOf('en').resources(2)).toBe('2 resources')
    expect(labelsOf('ja').resources(2)).toBe('リソース 2 件')
    expect(labelsOf('en').moreRoutes(14)).toBe('14 routes in all')
    expect(labelsOf('ja').updated('2026年5月5日')).toBe('2026年5月5日更新')
  })
})
