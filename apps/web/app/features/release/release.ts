import type { GameSummary, ResourceRule } from '~/features/game'
import type { Locale } from '~/shared/i18n/locale'
import { isoDate, siteDay, siteMonthStart } from '~/shared/i18n/site-time'

export type ReleaseMonth = { year: number; month: number }

export type ReleaseDay = { date: string; games: GameSummary[] }

export type Releases = {
  month: ReleaseMonth
  current: boolean
  resources: ResourceRule | undefined
  days: ReleaseDay[]
  total: number
}

export const pageSize = 100

export const maxPages = 5

export const firstYear = 1980

export const listsEveryGame = false

export function currentMonth(now: Date): ReleaseMonth {
  const start = siteMonthStart(now)
  return { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 }
}

export function monthKey({ year, month }: ReleaseMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function sameMonth(a: ReleaseMonth, b: ReleaseMonth): boolean {
  return a.year === b.year && a.month === b.month
}

export function shifted({ year, month }: ReleaseMonth, by: number): ReleaseMonth {
  const moved = new Date(Date.UTC(year, month - 1 + by, 1))
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1 }
}

export function monthStart({ year, month }: ReleaseMonth): Date {
  return new Date(Date.UTC(year, month - 1, 1))
}

export function monthWindow(month: ReleaseMonth): { start: string; end: string } {
  const last = new Date(Date.UTC(month.year, month.month, 0))
  return { start: isoDate(monthStart(month)), end: isoDate(last) }
}

export function latestMonth(now: Date): ReleaseMonth {
  return { year: currentMonth(now).year + 2, month: 12 }
}

export function withinRange(month: ReleaseMonth, now: Date): boolean {
  const latest = latestMonth(now)
  return (
    month.year >= firstYear &&
    (month.year < latest.year || (month.year === latest.year && month.month <= latest.month))
  )
}

export function byDay(games: readonly GameSummary[]): ReleaseDay[] {
  const days = new Map<string, GameSummary[]>()
  for (const game of games) {
    if (game.release_date === null) {
      continue
    }
    const date = siteDay(new Date(game.release_date))
    days.set(date, [...(days.get(date) ?? []), game])
  }
  return [...days]
    .map(([date, released]) => ({ date, games: released }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function releasesPath(
  locale: Locale,
  month: ReleaseMonth | undefined,
  resources: ResourceRule | undefined,
): string {
  const params = new URLSearchParams()
  if (month !== undefined) {
    params.set('month', monthKey(month))
  }
  if (resources !== undefined) {
    params.set('resources', resources)
  }
  const search = params.toString()
  return `/${locale}/release${search === '' ? '' : `?${search}`}`
}
