import diff from 'microdiff'
import { ROOT_PATH_KEY } from './constants'

export type DiffEntry = ReturnType<typeof diff>[number]
export interface ParsedEditChanges {
  added: unknown[]
  removed: unknown[]
  diffs: DiffEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const stringifySafe = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const formatValue = (value: unknown, emptyLabel: string): string => {
  if (value === null || value === undefined || value === '') {
    return emptyLabel
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return stringifySafe(value)
}

export const formatPath = (path: Array<string | number>, rootLabel: string): string => {
  if (path.length === 0) return rootLabel
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`
    if (!acc) return segment
    return `${acc}.${segment}`
  }, '')
}

const collapseStringArrayDiffs = (
  entries: DiffEntry[],
  before: unknown,
  after: unknown,
): DiffEntry[] => {
  if (!isRecord(before) && !isRecord(after)) return entries
  const beforeRecord = isRecord(before) ? before : {}
  const afterRecord = isRecord(after) ? after : {}

  const stringArrayFields = new Set<string>()
  for (const entry of entries) {
    const [field, idx] = entry.path
    if (typeof field === 'string' && typeof idx === 'number') {
      const bVal = beforeRecord[field]
      const aVal = afterRecord[field]
      if (
        (Array.isArray(bVal) && bVal.every(v => typeof v === 'string')) ||
        (Array.isArray(aVal) && aVal.every(v => typeof v === 'string'))
      ) {
        stringArrayFields.add(field)
      }
    }
  }

  if (stringArrayFields.size === 0) return entries

  const result: DiffEntry[] = entries.filter(e => {
    const [field, idx] = e.path
    return !(typeof field === 'string' && typeof idx === 'number' && stringArrayFields.has(field))
  })

  for (const field of stringArrayFields) {
    const oldValue = (beforeRecord[field] ?? []) as string[]
    const value = (afterRecord[field] ?? []) as string[]
    if (JSON.stringify([...oldValue].sort()) !== JSON.stringify([...value].sort())) {
      result.push({ type: 'CHANGE', path: [field], oldValue, value } as DiffEntry)
    }
  }

  return result
}

export const createDiffEntries = (before: unknown, after: unknown): DiffEntry[] => {
  const wrappedBefore = { [ROOT_PATH_KEY]: before ?? null }
  const wrappedAfter = { [ROOT_PATH_KEY]: after ?? null }

  const entries = diff(wrappedBefore, wrappedAfter).map(entry => ({
    ...entry,
    path: entry.path.slice(1),
  }))

  return collapseStringArrayDiffs(entries, before, after)
}

export const parseEditChanges = (changes: unknown): ParsedEditChanges => {
  if (!changes) {
    return { added: [], removed: [], diffs: [] }
  }

  const record = isRecord(changes) ? changes : null
  const hasAddedRemoved =
    !!record &&
    (Array.isArray(record.added) ||
      Array.isArray(record.removed) ||
      'added' in record ||
      'removed' in record)

  const added = hasAddedRemoved && Array.isArray(record?.added) ? record.added : []
  const removed = hasAddedRemoved && Array.isArray(record?.removed) ? record.removed : []

  const hasBeforeAfter =
    !!record && ('before' in record || 'after' in record || 'relation' in record)
  const before = hasBeforeAfter ? record?.before : undefined
  const after = hasBeforeAfter ? record?.after : undefined

  const fieldDiffs =
    hasBeforeAfter && (before !== undefined || after !== undefined)
      ? createDiffEntries(before, after)
      : []

  const fallbackDiffs = !hasAddedRemoved && !hasBeforeAfter ? createDiffEntries({}, changes) : []

  return {
    added,
    removed,
    diffs: fieldDiffs.length > 0 ? fieldDiffs : fallbackDiffs,
  }
}
