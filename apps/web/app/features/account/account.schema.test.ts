import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import { emailForm, linkResultFrom, passkeyFinishCommand, passwordForm } from './account.schema'

const kit = createFormKit(issue => issue.kind)

describe('linkResultFrom', () => {
  it('reads what the return from Hikarinagi ID says', () => {
    expect(linkResultFrom(new URLSearchParams(''))).toBeUndefined()
    expect(linkResultFrom(new URLSearchParams('oidc_linked=1'))).toEqual({
      linked: true,
      reason: undefined,
    })
    expect(linkResultFrom(new URLSearchParams('oidc_error=link_conflict'))).toEqual({
      linked: false,
      reason: 'link_conflict',
    })
  })
})

describe('emailForm', () => {
  it('needs the new address and both codes', () => {
    const form = emailForm(kit)
    const valid = { email: 'new@example.test', currentCode: 'ABC123', newCode: 'DEF456' }
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, email: 'nope' })).toBe('format')
    expect(firstIssueMessage(form, { ...valid, currentCode: '' })).toBe('required')
    expect(firstIssueMessage(form, { ...valid, newCode: ' ' })).toBe('required')
  })
})

describe('passwordForm', () => {
  it('needs both passwords and a matching confirmation', () => {
    const form = passwordForm(kit, issue => issue)
    const valid = { oldPassword: 'old', password: 'new-password', confirmation: 'new-password' }
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, oldPassword: '' })).toBe('required')
    expect(firstIssueMessage(form, { ...valid, confirmation: 'other' })).toBe('mismatch')
  })
})

describe('passkeyFinishCommand', () => {
  it('parses the credential the browser created', () => {
    const credential = JSON.stringify({
      id: 'abc',
      rawId: 'abc',
      response: { attestationObject: 'x' },
    })
    expect(
      parseOptional(passkeyFinishCommand, { flowId: 'f', name: 'MacBook', credential }),
    ).toMatchObject({ flowId: 'f', credential: { id: 'abc' } })
    expect(
      parseOptional(passkeyFinishCommand, { flowId: 'f', name: '', credential: 'not json' }),
    ).toBeUndefined()
  })
})
