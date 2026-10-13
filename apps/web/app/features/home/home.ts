import type { GameSummary } from '~/features/game'
import { isoDate, siteMonthStart } from '~/shared/i18n/site-time'

export const recentSize = 12

export const releasesSize = 40

export const hotSize = 12

export type Block<Data> = { ok: true; data: Data } | { ok: false }

export type HomeContent = {
  month: number
  recent: Block<GameSummary[]>
  releases: Block<GameSummary[]>
  hot: Block<GameSummary[]>
}

export function monthWindow(now: Date) {
  const first = siteMonthStart(now)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  return { month: first.getUTCMonth() + 1, start: isoDate(first), end: isoDate(last) }
}
