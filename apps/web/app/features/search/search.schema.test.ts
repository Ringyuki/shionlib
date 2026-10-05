import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { pageParam, parseRecent, recordSearchCommand } from './search.schema'

describe('recordSearchCommand', () => {
  it('needs a query', () => {
    expect(parseOptional(recordSearchCommand, { query: 'sakura' })).toEqual({ query: 'sakura' })
    expect(parseOptional(recordSearchCommand, {})).toBeUndefined()
  })
})

describe('parseRecent', () => {
  it('reads only well-formed stored lists', () => {
    expect(parseRecent('["a", 1, " b "]')).toEqual(['a', 'b'])
    expect(parseRecent('{')).toEqual([])
    expect(parseRecent('"a"')).toEqual([])
    expect(parseRecent(null)).toEqual([])
  })
})

describe('pageParam', () => {
  it('parses positive pages and falls back to the first', () => {
    expect(pageParam('3')).toBe(3)
    expect(pageParam('0')).toBe(1)
    expect(pageParam('x')).toBe(1)
    expect(pageParam(null)).toBe(1)
  })
})
