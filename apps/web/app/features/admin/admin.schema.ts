import * as v from 'valibot'
import { defaultTrendRange, trendRanges, type TrendRange } from './admin-stats'

const range = v.fallback(
  v.pipe(v.string(), v.toNumber(), v.picklist(trendRanges)),
  defaultTrendRange,
)

export function trendRangeFrom(value: string | null): TrendRange {
  return v.parse(range, value)
}
