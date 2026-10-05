import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { membershipChangeCommand } from './favorite.schema'

describe('membershipChangeCommand', () => {
  it('accepts a complete change', () => {
    expect(
      parseOptional(membershipChangeCommand, { listId: 2, gameId: 9, included: true }),
    ).toEqual({ listId: 2, gameId: 9, included: true })
  })

  it('rejects malformed input', () => {
    for (const value of [
      { listId: '2', gameId: 9, included: true },
      { listId: 2, gameId: 0, included: true },
      { listId: 2.5, gameId: 9, included: true },
      null,
    ]) {
      expect(parseOptional(membershipChangeCommand, value)).toBeUndefined()
    }
  })
})
