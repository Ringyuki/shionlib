import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { filterFrom, uploadTerminationCommand } from './admin-upload.schema'

describe('filterFrom', () => {
  it('reads the filters and the opened session', () => {
    expect(filterFrom(new URLSearchParams('stage=pending&q=zip&user=9&failed=1&id=8'), 2)).toEqual({
      stage: 'pending',
      query: 'zip',
      user: 9,
      failed: true,
      page: 2,
      opened: { kind: 'session', id: 8 },
    })
  })

  it('opens an upload that never started by its failure', () => {
    expect(filterFrom(new URLSearchParams('attempt=3'), 1).opened).toEqual({
      kind: 'attempt',
      id: 3,
    })
  })

  it('falls back to every upload', () => {
    expect(filterFrom(new URLSearchParams('stage=done&user=x&failed=yes&id=0'), 1)).toEqual({
      stage: 'all',
      query: '',
      user: undefined,
      failed: false,
      page: 1,
      opened: undefined,
    })
  })
})

describe('uploadTerminationCommand', () => {
  it('takes the id of a session', () => {
    expect(parseOptional(uploadTerminationCommand, { id: 8 })).toEqual({ id: 8 })
    expect(parseOptional(uploadTerminationCommand, { id: 0 })).toBeUndefined()
  })
})
