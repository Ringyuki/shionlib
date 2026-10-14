import type { Locale } from '@/config'

const intlLocales: Record<Locale, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }

const siteTimeZone = 'Asia/Shanghai'

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(intlLocales[locale]).format(value)
}

export function formatCalendarDay(locale: Locale, iso: string): string {
  return formatDate(locale, iso, 'UTC')
}

export function formatSiteDay(locale: Locale, iso: string): string {
  return formatDate(locale, iso, siteTimeZone)
}

function formatDate(locale: Locale, iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'long', timeZone }).format(date)
}

export function formatBytes(locale: Locale, bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : 2
  const number = new Intl.NumberFormat(intlLocales[locale], {
    maximumFractionDigits: digits,
  }).format(value)
  return `${number} ${byteUnits[unit]}`
}
