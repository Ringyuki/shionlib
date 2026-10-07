export const siteTimeZone = 'Asia/Shanghai'

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function siteMonthStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: siteTimeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(entry => entry.type === type)?.value ?? ''
  return new Date(`${part('year')}-${part('month')}-01T00:00:00Z`)
}
