import { describe, expect, it } from 'vitest'
import {
  createDiffEntries,
  createStringDiff,
  formatPath,
  formatValue,
  parseEditChanges,
} from '../../../../components/user/home/edits/helpers/edit-changes'

describe('components/user/home/edits/helpers/edit-changes (unit)', () => {
  it('formats values and paths', () => {
    expect(formatValue(null, '-')).toBe('-')
    expect(formatValue(123, '-')).toBe('123')
    expect(formatPath([], 'root')).toBe('root')
    expect(formatPath(['game', 0, 'title'], 'root')).toBe('game[0].title')
  })

  it('parses edit changes from before/after payload', () => {
    const parsed = parseEditChanges({
      before: { title: 'old', tags: ['a'] },
      after: { title: 'new', tags: ['a', 'b'] },
    })

    expect(parsed.added).toEqual([])
    expect(parsed.removed).toEqual([])
    expect(parsed.diffs.length).toBeGreaterThan(0)
  })

  it('builds fallback diff entries for raw payload', () => {
    const diffs = createDiffEntries({ foo: 'a' }, { foo: 'b' })
    expect(diffs.length).toBeGreaterThan(0)

    const parsed = parseEditChanges({ foo: 'bar' })
    expect(parsed.diffs.length).toBeGreaterThan(0)
  })

  it('creates string diff segments with changed markers', () => {
    const result = createStringDiff('hello world', 'hello brave world')
    expect(result.before.length).toBeGreaterThan(0)
    expect(result.after.length).toBeGreaterThan(0)
    expect(result.after.some(segment => segment.changed)).toBe(true)
  })
})
