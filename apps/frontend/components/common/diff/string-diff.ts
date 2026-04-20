import { STRING_DIFF_DP_MAX_CELLS } from './constants'

type StringDiffOperation = 'equal' | 'remove' | 'add'

export interface StringDiffSegment {
  text: string
  changed: boolean
}

export interface StringDiffResult {
  before: StringDiffSegment[]
  after: StringDiffSegment[]
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
  operation: StringDiffOperation,
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

const trimSharedEdges = (before: string, after: string) => {
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

  return {
    prefix: beforeChars.slice(0, prefixLength).join(''),
    suffix: beforeChars.slice(beforeEnd + 1).join(''),
    beforeMiddle: beforeChars.slice(prefixLength, beforeEnd + 1),
    afterMiddle: afterChars.slice(prefixLength, afterEnd + 1),
  }
}

const buildOperations = (beforeMiddle: string[], afterMiddle: string[]) => {
  const rows = beforeMiddle.length + 1
  const cols = afterMiddle.length + 1
  const lcs: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      lcs[i][j] =
        beforeMiddle[i - 1] === afterMiddle[j - 1]
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1])
    }
  }

  const operations: Array<{ type: StringDiffOperation; text: string }> = []
  let i = beforeMiddle.length
  let j = afterMiddle.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeMiddle[i - 1] === afterMiddle[j - 1]) {
      operations.push({ type: 'equal', text: beforeMiddle[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      operations.push({ type: 'add', text: afterMiddle[j - 1] })
      j--
    } else if (i > 0) {
      operations.push({ type: 'remove', text: beforeMiddle[i - 1] })
      i--
    }
  }

  return operations.reverse()
}

export const createStringDiff = (before: string, after: string): StringDiffResult => {
  const { prefix, suffix, beforeMiddle, afterMiddle } = trimSharedEdges(before, after)
  const beforeSegments: StringDiffSegment[] = []
  const afterSegments: StringDiffSegment[] = []

  applyOperation('equal', prefix, beforeSegments, afterSegments)

  if (beforeMiddle.length * afterMiddle.length > STRING_DIFF_DP_MAX_CELLS) {
    applyOperation('remove', beforeMiddle.join(''), beforeSegments, afterSegments)
    applyOperation('add', afterMiddle.join(''), beforeSegments, afterSegments)
  } else {
    for (const operation of buildOperations(beforeMiddle, afterMiddle)) {
      applyOperation(operation.type, operation.text, beforeSegments, afterSegments)
    }
  }

  applyOperation('equal', suffix, beforeSegments, afterSegments)
  return { before: beforeSegments, after: afterSegments }
}
