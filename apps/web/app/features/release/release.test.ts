import { describe, expect, it } from 'vitest'
import { sitePaths } from '~/features/shell'
import type { GameSummary } from '~/features/game'
import {
  byDay,
  currentMonth,
  monthKey,
  monthWindow,
  releasesPath,
  sameMonth,
  shifted,
  withinRange,
} from './release'
import { monthFrom } from './release.schema'

const now = new Date('2026-10-08T12:00:00Z')

const game = (id: number, released: string | null): GameSummary => ({
  id,
  title_zh: '',
  title_jp: `game ${id}`,
  title_en: '',
  intro_zh: '',
  intro_jp: '',
  intro_en: '',
  aliases: null,
  type: null,
  release_date: released,
  covers: null,
  developers: null,
  tags: null,
  resources: { count: 0, downloads: 0, languages: null, platforms: null, latest: null },
})

describe('months', () => {
  it('follow the site clock', () => {
    expect(currentMonth(new Date('2026-09-30T16:30:00Z'))).toEqual({ year: 2026, month: 10 })
    expect(monthKey({ year: 2026, month: 4 })).toBe('2026-04')
  })

  it('move across years', () => {
    expect(shifted({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shifted({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(sameMonth(shifted({ year: 2026, month: 10 }, 0), currentMonth(now))).toBe(true)
  })

  it('span their first to their last day', () => {
    expect(monthWindow({ year: 2024, month: 2 })).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
  })

  it('are read from the address within the years the site covers', () => {
    expect(monthFrom('2025-04', now)).toEqual({ year: 2025, month: 4 })
    expect(monthFrom(null, now)).toEqual({ year: 2026, month: 10 })
    for (const raw of ['2025-13', '2025-4', 'april', '1979-12', '2029-01']) {
      expect(monthFrom(raw, now)).toEqual({ year: 2026, month: 10 })
    }
    expect(withinRange({ year: 2028, month: 12 }, now)).toBe(true)
  })
})

describe('byDay', () => {
  it('groups games by the day shown on their cards, earliest first', () => {
    const days = byDay([
      game(3, '2025-04-25T00:00:00Z'),
      game(1, '2025-04-01T00:00:00Z'),
      game(2, '2025-04-24T16:00:00Z'),
      game(4, null),
    ])
    expect(days.map(day => [day.date, day.games.map(entry => entry.id)])).toEqual([
      ['2025-04-01', [1]],
      ['2025-04-25', [3, 2]],
    ])
  })
})

describe('releasesPath', () => {
  it('is where the sidebar and the home page link to', () => {
    expect(releasesPath('zh', undefined, undefined)).toBe(sitePaths('zh').releases)
  })

  it('keeps the month and the resource rule in the address', () => {
    expect(releasesPath('ja', { year: 2025, month: 4 }, 'required')).toBe(
      '/ja/release?month=2025-04&resources=required',
    )
  })
})
