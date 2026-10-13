import * as v from 'valibot'
import { categories, type Category } from './admin-moderation'
import { defaultTrendRange, trendRanges, type TrendRange } from './admin-stats'

const range = v.fallback(
  v.pipe(v.string(), v.toNumber(), v.picklist(trendRanges)),
  defaultTrendRange,
)

export function trendRangeFrom(value: string | null): TrendRange {
  return v.parse(range, value)
}

const scores = v.fallback(v.record(v.string(), v.number()), {})

export function scoresFrom(raw: unknown): Record<string, number> {
  return v.parse(scores, raw)
}

export function categoryFrom(raw: string): Category | undefined {
  const parsed = v.safeParse(v.picklist(categories), raw)
  return parsed.success ? parsed.output : undefined
}
