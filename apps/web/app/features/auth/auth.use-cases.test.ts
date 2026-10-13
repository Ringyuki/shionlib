import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { checkPasswordResetLink, requestSignUpCode, signIn, signUp } from './auth.use-cases'

describe('signIn', () => {
  it('trims the identifier but not the password', async () => {
    const fake = fakeApi().on('post', '/user/login', { accessTokenExp: 1 })
    await signIn(fake.api, { identifier: ' e2e ', password: ' secret ' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      identifier: 'e2e',
      password: ' secret ',
    })
  })
})

describe('signUp', () => {
  it('registers with the code and signs in with the new email', async () => {
    const fake = fakeApi()
      .on('post', '/user', {
        id: 1,
        name: 'n',
        email: 'a@b.co',
        role: 1,
        created: '2026-01-01T00:00:00Z',
      })
      .on('post', '/user/login', { accessTokenExp: 1 })
    await signUp(fake.api, {
      name: ' n ',
      email: ' a@b.co ',
      password: 'Secret12',
      code: '123456',
      codeId: 'c',
      locale: 'ja',
    })
    const [register, login] = fake.requests
    await expect(register?.json()).resolves.toEqual({
      name: 'n',
      email: 'a@b.co',
      password: 'Secret12',
      code: '123456',
      uuid: 'c',
      lang: 'ja',
    })
    await expect(login?.json()).resolves.toEqual({ identifier: 'a@b.co', password: 'Secret12' })
  })

  it('does not sign in when the registration fails', async () => {
    const fake = fakeApi().fail('post', '/user', 409, { code: 300102, message: 'taken' })
    await expect(
      signUp(fake.api, {
        name: 'n',
        email: 'a@b.co',
        password: 'Secret12',
        code: '1',
        codeId: 'c',
        locale: 'zh',
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(fake.requests).toHaveLength(1)
  })
})

describe('requestSignUpCode', () => {
  it('returns the code id', async () => {
    const { api } = fakeApi().on('post', '/auth/code/request', { uuid: 'u' })
    await expect(requestSignUpCode(api, { email: 'a@b.co' })).resolves.toEqual({ codeId: 'u' })
  })
})

describe('checkPasswordResetLink', () => {
  it('treats rejected links as invalid and surfaces outages', async () => {
    await expect(
      checkPasswordResetLink(
        fakeApi().on('post', '/auth/password/forget/check', true).api,
        't',
        'e',
      ),
    ).resolves.toBe(true)
    await expect(
      checkPasswordResetLink(
        fakeApi().fail('post', '/auth/password/forget/check', 422, { code: 100101, message: 'bad' })
          .api,
        't',
        'e',
      ),
    ).resolves.toBe(false)
    await expect(
      checkPasswordResetLink(
        fakeApi().fail('post', '/auth/password/forget/check', 503, { code: 503, message: 'down' })
          .api,
        't',
        'e',
      ),
    ).rejects.toMatchObject({ status: 503 })
  })
})
