import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { listForm, membershipChangeCommand } from './favorite.schema'

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

describe('listForm', () => {
  const form = listForm(createFormKit(issue => issue.kind))

  it('needs a name within the API limits', () => {
    const valid = { name: '想玩', description: '', isPrivate: false }
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, name: '  ' })).toBe('required')
    expect(firstIssueMessage(form, { ...valid, name: '汐'.repeat(300) })).toBe('maxLength')
    expect(firstIssueMessage(form, { ...valid, description: '汐'.repeat(2001) })).toBe('maxLength')
  })
})
