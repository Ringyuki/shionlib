import { describe, expect, it } from 'vitest'
import {
  isAuthView,
  meetsPasswordPolicy,
  parsePasskeyAssertion,
  parseSignIn,
  parseSignUp,
  passwordResetIssues,
  remainingSeconds,
  signInIssues,
  signUpIssues,
} from './auth'

describe('auth views', () => {
  it('recognises the dialog views only', () => {
    expect(isAuthView('sign-up')).toBe(true)
    expect(isAuthView('login')).toBe(false)
    expect(isAuthView(null)).toBe(false)
  })
})

describe('command parsing', () => {
  it('accepts well-formed commands and rejects the rest', () => {
    expect(parseSignIn({ identifier: 'a', password: 'b' })).toEqual({
      identifier: 'a',
      password: 'b',
    })
    expect(parseSignIn({ identifier: 'a' })).toBeUndefined()
    expect(parseSignIn('a')).toBeUndefined()
    const signUp = { name: 'n', email: 'e', password: 'p', code: '1', codeId: 'c', locale: 'ja' }
    expect(parseSignUp(signUp)).toEqual(signUp)
    expect(parseSignUp({ ...signUp, locale: 'fr' })).toBeUndefined()
  })

  it('reads the passkey credential from its JSON text', () => {
    expect(parsePasskeyAssertion({ flowId: 'f', credential: '{"id":"x"}' })).toEqual({
      flowId: 'f',
      credential: { id: 'x' },
    })
    expect(parsePasskeyAssertion({ flowId: 'f', credential: '[1]' })).toBeUndefined()
    expect(parsePasskeyAssertion({ flowId: 'f', credential: '{' })).toBeUndefined()
  })
})

describe('form issues', () => {
  it('requires both sign-in fields', () => {
    expect(signInIssues({ identifier: ' ', password: '' })).toEqual({
      identifier: 'required',
      password: 'required',
    })
    expect(signInIssues({ identifier: 'a', password: 'b' })).toEqual({})
  })

  it('checks every sign-up rule', () => {
    expect(
      signUpIssues({ name: 'a', email: 'bad', code: '12', password: 'short', adult: false }),
    ).toEqual({
      name: 'nameLength',
      email: 'email',
      code: 'codeLength',
      password: 'passwordLength',
      adult: 'adult',
    })
    expect(
      signUpIssues({
        name: '汐',
        email: 'a@b.co',
        code: '123456',
        password: 'alllowercase1',
        adult: true,
      }),
    ).toEqual({ name: 'nameLength', password: 'passwordPolicy' })
    expect(
      signUpIssues({
        name: '汐汐',
        email: 'a@b.co',
        code: '123456',
        password: 'Secret12',
        adult: true,
      }),
    ).toEqual({})
  })

  it('mirrors the password policy of the API', () => {
    expect(meetsPasswordPolicy('Secret12')).toBe(true)
    expect(meetsPasswordPolicy('Secret!!')).toBe(true)
    expect(meetsPasswordPolicy('Secret__')).toBe(false)
    expect(meetsPasswordPolicy('secret12')).toBe(false)
  })

  it('wants the confirmation to match', () => {
    expect(passwordResetIssues({ password: 'Secret12', confirmation: 'Secret13' })).toEqual({
      confirmation: 'mismatch',
    })
  })
})

describe('remainingSeconds', () => {
  it('counts down from the last request', () => {
    expect(remainingSeconds(undefined, 1000)).toBe(0)
    expect(remainingSeconds(0, 15_500)).toBe(45)
    expect(remainingSeconds(0, 61_000)).toBe(0)
  })
})
