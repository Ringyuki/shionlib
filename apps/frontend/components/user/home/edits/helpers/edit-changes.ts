import diff from 'microdiff'
import { ROOT_PATH_KEY, STRING_DIFF_DP_MAX_CELLS } from '../constants/edit-changes'

export type DiffEntry = ReturnType<typeof diff>[number]
export interface StringDiffSegment {
  text: string
  changed: boolean
}

export interface StringDiffResult {
  before: StringDiffSegment[]
  after: StringDiffSegment[]
}

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

export const createDiffEntries = (before: unknown, after: unknown): DiffEntry[] => {
  const wrappedBefore = { [ROOT_PATH_KEY]: before ?? null }
  const wrappedAfter = { [ROOT_PATH_KEY]: after ?? null }

  return diff(wrappedBefore, wrappedAfter).map(entry => ({
    ...entry,
    path: entry.path.slice(1),
  }))
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

const appendSegment = (segments: StringDiffSegment[], text: string, changed: boolean) => {
  if (!text) return
  const previous = segments[segments.length - 1]
  if (previous && previous.changed === changed) {
    previous.text += text
    return
  }
  segments.push({ text, changed })
}

const applyOperation = (
  operation: 'equal' | 'remove' | 'add',
  text: string,
  beforeSegments: StringDiffSegment[],
  afterSegments: StringDiffSegment[],
) => {
  if (!text) return
  if (operation === 'equal') {
    appendSegment(beforeSegments, text, false)
    appendSegment(afterSegments, text, false)
    return
  }
  if (operation === 'remove') {
    appendSegment(beforeSegments, text, true)
    return
  }
  appendSegment(afterSegments, text, true)
}

export const createStringDiff = (before: string, after: string): StringDiffResult => {
  const beforeChars = Array.from(before)
  const afterChars = Array.from(after)

  let prefixLength = 0
  while (
    prefixLength < beforeChars.length &&
    prefixLength < afterChars.length &&
    beforeChars[prefixLength] === afterChars[prefixLength]
  ) {
    prefixLength++
  }

  let beforeEnd = beforeChars.length - 1
  let afterEnd = afterChars.length - 1
  while (
    beforeEnd >= prefixLength &&
    afterEnd >= prefixLength &&
    beforeChars[beforeEnd] === afterChars[afterEnd]
  ) {
    beforeEnd--
    afterEnd--
  }

  const prefix = beforeChars.slice(0, prefixLength).join('')
  const suffix = beforeChars.slice(beforeEnd + 1).join('')
  const beforeMiddle = beforeChars.slice(prefixLength, beforeEnd + 1)
  const afterMiddle = afterChars.slice(prefixLength, afterEnd + 1)

  const beforeSegments: StringDiffSegment[] = []
  const afterSegments: StringDiffSegment[] = []

  applyOperation('equal', prefix, beforeSegments, afterSegments)

  if (beforeMiddle.length === 0 && afterMiddle.length === 0) {
    applyOperation('equal', suffix, beforeSegments, afterSegments)
    return { before: beforeSegments, after: afterSegments }
  }

  if (beforeMiddle.length * afterMiddle.length > STRING_DIFF_DP_MAX_CELLS) {
    applyOperation('remove', beforeMiddle.join(''), beforeSegments, afterSegments)
    applyOperation('add', afterMiddle.join(''), beforeSegments, afterSegments)
    applyOperation('equal', suffix, beforeSegments, afterSegments)
    return { before: beforeSegments, after: afterSegments }
  }

  const rows = beforeMiddle.length + 1
  const cols = afterMiddle.length + 1
  const lcs: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (beforeMiddle[i - 1] === afterMiddle[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  const operations: Array<{ type: 'equal' | 'remove' | 'add'; text: string }> = []
  let i = beforeMiddle.length
  let j = afterMiddle.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeMiddle[i - 1] === afterMiddle[j - 1]) {
      operations.push({ type: 'equal', text: beforeMiddle[i - 1] })
      i--
      j--
      continue
    }

    if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      operations.push({ type: 'add', text: afterMiddle[j - 1] })
      j--
      continue
    }

    operations.push({ type: 'remove', text: beforeMiddle[i - 1] })
    i--
  }

  operations.reverse()
  for (const operation of operations) {
    applyOperation(operation.type, operation.text, beforeSegments, afterSegments)
  }

  applyOperation('equal', suffix, beforeSegments, afterSegments)
  return { before: beforeSegments, after: afterSegments }
}
