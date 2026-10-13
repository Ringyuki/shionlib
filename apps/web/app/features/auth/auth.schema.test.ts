import { describe, expect, it } from 'vitest'
import { firstIssueMessage, parseOptional } from '~/shared/form/check'
import { createFormKit } from '~/shared/form/form-kit'
import {
  isAuthView,
  passkeyAssertionCommand,
  passwordResetForm,
  signInCommand,
  signUpCommand,
  signUpForm,
} from './auth.schema'

const kit = createFormKit(issue => issue.kind)
const issue = (key: string) => key

describe('commands', () => {
  it('accept well-formed bodies only', () => {
    expect(parseOptional(signInCommand, { identifier: 'a', password: 'b' })).toEqual({
      identifier: 'a',
      password: 'b',
    })
    expect(parseOptional(signInCommand, { identifier: 'a' })).toBeUndefined()
    const signUp = { name: 'n', email: 'e', password: 'p', code: '1', codeId: 'c', locale: 'ja' }
    expect(parseOptional(signUpCommand, signUp)).toEqual(signUp)
    expect(parseOptional(signUpCommand, { ...signUp, locale: 'fr' })).toBeUndefined()
  })

  it('read the passkey credential from its JSON text', () => {
    const credential = { id: 'x', response: { clientDataJSON: 'c' } }
    expect(
      parseOptional(passkeyAssertionCommand, {
        flowId: 'f',
        credential: JSON.stringify(credential),
      }),
    ).toEqual({ flowId: 'f', credential })
    expect(
      parseOptional(passkeyAssertionCommand, { flowId: 'f', credential: '[1]' }),
    ).toBeUndefined()
    expect(parseOptional(passkeyAssertionCommand, { flowId: 'f', credential: '{' })).toBeUndefined()
  })
})

describe('forms', () => {
  const valid = {
    name: '汐汐',
    email: 'a@b.co',
    code: '0A3F9C',
    password: 'whatever1',
    adult: true,
  }

  it('check sign-up fields against the API constraints and the age declaration', () => {
    expect(firstIssueMessage(signUpForm(kit, issue), valid)).toBeUndefined()
    expect(firstIssueMessage(signUpForm(kit, issue), { ...valid, name: '汐' })).toBe('minLength')
    expect(firstIssueMessage(signUpForm(kit, issue), { ...valid, email: 'mail' })).toBe('format')
    expect(firstIssueMessage(signUpForm(kit, issue), { ...valid, adult: false })).toBe('adult')
  })

  it('leave rules that only the API knows to the API', () => {
    expect(firstIssueMessage(signUpForm(kit, issue), { ...valid, password: 'alllowercase' })).toBe(
      undefined,
    )
  })

  it('report a mismatched confirmation on the confirmation field', () => {
    const form = passwordResetForm(kit, issue)
    expect(
      firstIssueMessage(form, { password: 'Secret12', confirmation: 'Secret12' }),
    ).toBeUndefined()
    expect(firstIssueMessage(form, { password: 'Secret12', confirmation: 'Secret13' })).toBe(
      'mismatch',
    )
  })

  it('recognises the dialog views only', () => {
    expect(isAuthView('sign-up')).toBe(true)
    expect(isAuthView('login')).toBe(false)
    expect(isAuthView(null)).toBe(false)
  })
})
