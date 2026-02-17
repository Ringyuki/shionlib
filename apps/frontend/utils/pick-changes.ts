import diff from 'microdiff'

export interface ChangesResult {
  before: Record<string, unknown>
  after: Record<string, unknown>
  field_changes: string[]
}

const normalizeDate = (value: unknown): number | unknown => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? value : time
  }
  return value
}

/**
 * recursively normalize the data copy for comparison (without changing the original object)
 */
const deepNormalize = <T = unknown>(value: T): T => {
  const v = normalizeDate(value) as any
  if (Array.isArray(v)) {
    return v.map(item => deepNormalize(item)) as any
  }
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v)) {
      out[k] = deepNormalize((v as Record<string, unknown>)[k])
    }
    return out as any
  }
  return v
}

export const pickChanges = (dto: any, original: any) => {
  const candidateKeys = Object.keys(dto).filter(
    key =>
      (dto as Record<string, unknown>)[key] !== undefined &&
      (dto as Record<string, unknown>)[key] !== null,
  )

  // get subsets
  const beforeSubset: Record<string, unknown> = {}
  const afterSubset: Record<string, unknown> = {}
  for (const key of candidateKeys) {
    beforeSubset[key] = (original as unknown as Record<string, unknown>)[key]
    afterSubset[key] = (dto as unknown as Record<string, unknown>)[key]
  }

  const beforeNorm = deepNormalize(beforeSubset)
  const afterNorm = deepNormalize(afterSubset)
  const diffs = diff(beforeNorm, afterNorm)

  // we only need to check if the top-level field has changed: collect path[0]
  const changedTopKeySet = new Set<string>()
  for (const d of diffs) {
    const top = d.path[0]
    if (typeof top === 'string') {
      changedTopKeySet.add(top)
    } else if (typeof top === 'number') {
      // in rare cases, the candidate key itself is an array; here we find the array key name
      // (i.e. when path starts with a number, it means the comparison itself is an array; this helper only handles top-level fields of objects)
    }
  }

  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  const field_changes: string[] = []
  for (const key of candidateKeys) {
    if (changedTopKeySet.has(key)) {
      before[key] = (original as any)[key]
      after[key] = (dto as any)[key]
      field_changes.push(key)
    }
  }

  return { before, after, field_changes }
}
