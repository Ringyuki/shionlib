import * as v from 'valibot'
import { currentMonth, withinRange, type ReleaseMonth } from './release'

const monthParam = v.pipe(
  v.string(),
  v.regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  v.transform(raw => {
    const [year = '', month = ''] = raw.split('-')
    return { year: Number.parseInt(year, 10), month: Number.parseInt(month, 10) }
  }),
)

export function monthFrom(raw: string | null, now: Date): ReleaseMonth {
  const parsed = v.safeParse(monthParam, raw)
  return parsed.success && withinRange(parsed.output, now) ? parsed.output : currentMonth(now)
}
