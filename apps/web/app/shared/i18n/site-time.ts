export const siteTimeZone = 'Asia/Shanghai'

export const siteOffset = '+08:00'

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

export function siteDay(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: siteTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(entry => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function siteMinute(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: siteTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(entry => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function siteInstant(minute: string): string {
  return `${minute}:00${siteOffset}`
}
