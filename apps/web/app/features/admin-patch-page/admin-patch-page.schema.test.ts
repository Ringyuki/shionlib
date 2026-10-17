import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { addressForm, assignCommand, lookupCommand } from './admin-patch-page.schema'

const kit = createFormKit(issue => issue.kind)

describe('addressForm', () => {
  it('needs an address within the length the API takes', () => {
    const form = addressForm(kit)
    expect(
      firstIssueMessage(form, { address: 'https://www.moyu.moe/galgame/212857' }),
    ).toBeUndefined()
    expect(firstIssueMessage(form, { address: '' })).toBe('required')
    expect(firstIssueMessage(form, { address: 'x'.repeat(501) })).toBe('maxLength')
  })
})

describe('the commands', () => {
  it('carry an assignment and an address', () => {
    expect(
      parseOptional(assignCommand, { id: 20549, manual: true, pages: ['10363', '211652'] }),
    ).toEqual({
      id: 20549,
      manual: true,
      pages: ['10363', '211652'],
    })
    expect(parseOptional(assignCommand, { id: 0, manual: true, pages: [] })).toBeUndefined()
    expect(parseOptional(assignCommand, { id: 1, manual: 'yes', pages: [] })).toBeUndefined()
    expect(parseOptional(lookupCommand, { address: '212857' })).toEqual({ address: '212857' })
    expect(parseOptional(lookupCommand, {})).toBeUndefined()
  })
})
