import qs from 'qs'
import { SortBy, SortOrder } from '@/components/game/filter/enums/Sort.enum'
import { ExtraQuery } from '@/components/common/content/Pagination'

export type GameFilter = {
  tags: string[]
  years: number[]
  months: number[]
  sort_by: SortBy
  sort_order: SortOrder
}

const toArray = <T extends string | number>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[]
  if (v == null) return []
  return [v as T]
}
const toNumberArray = (v: unknown): number[] => {
  return toArray<string | number>(v)
    .map(n => Number(n))
    .filter(Number.isFinite)
}
const parsePage = (input: unknown, fallback = 1): number => {
  const raw = Array.isArray(input) ? input[0] : input
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.trunc(n))
}

export const parseGameQueryString = (qsString: string): { filter: GameFilter; page: number } => {
  const parsed = qs.parse(qsString) as {
    filter?: {
      tags?: string[] | string
      years?: (string | number)[] | string
      months?: (string | number)[] | string
      sort_by?: SortBy
      sort_order?: SortOrder
    }
    page?: string | number
  }

  const f = parsed.filter ?? {}
  const filter: GameFilter = {
    tags: toArray<string>(f.tags),
    years: toNumberArray(f.years),
    months: toNumberArray(f.months),
    sort_by: (f.sort_by ?? SortBy.RELEASE_DATE) as SortBy,
    sort_order: (f.sort_order ?? SortOrder.DESC) as SortOrder,
  }

  const page = parsePage(parsed.page, 1)
  return { filter, page }
}

export const parseGameSearchParams = (sp: ExtraQuery): { filter: GameFilter; page: number } => {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (Array.isArray(v)) v.forEach(x => usp.append(k, String(x)))
    else if (v !== undefined) usp.append(k, String(v))
  }
  return parseGameQueryString(usp.toString())
}
