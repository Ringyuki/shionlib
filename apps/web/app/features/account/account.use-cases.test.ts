import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import {
  bindPotato,
  changeEmail,
  changePassword,
  finishPasskey,
  loadConnections,
  loadSecurity,
  removePasskey,
  requestCurrentEmailCode,
  requestNewEmailCode,
  startPasskey,
  unlinkIdentity,
} from './account.use-cases'

const unauthorized = { code: 200101, message: 'unauthorized' }

describe('loadSecurity', () => {
  it('lists the passkeys of the viewer', async () => {
    const fake = fakeApi().on('get', '/auth/passkey', null)
    await expect(loadSecurity(fake.api)).resolves.toEqual({ passkeys: [] })
  })

  it('is nothing for a guest', async () => {
    const fake = fakeApi().fail('get', '/auth/passkey', 401, unauthorized)
    await expect(loadSecurity(fake.api)).resolves.toBeNull()
  })
})

describe('loadConnections', () => {
  const identities = { can_unlink: false, items: [] }

  it('treats a missing PotatoVN binding as not linked', async () => {
    const fake = fakeApi()
      .on('get', '/auth/oidc/identities', identities)
      .fail('get', '/potatovn/binding', 404, { code: 540101, message: 'not bound' })
    await expect(loadConnections(fake.api, undefined)).resolves.toEqual({
      identities,
      potato: null,
      linkResult: undefined,
    })
  })

  it('lets other failures of the binding fail the page, and is nothing for a guest', async () => {
    const broken = fakeApi()
      .on('get', '/auth/oidc/identities', identities)
      .fail('get', '/potatovn/binding', 502, { code: 540104, message: 'upstream' })
    await expect(loadConnections(broken.api, undefined)).rejects.toMatchObject({ status: 502 })
    const guest = fakeApi()
      .fail('get', '/auth/oidc/identities', 401, unauthorized)
      .fail('get', '/potatovn/binding', 401, unauthorized)
    await expect(loadConnections(guest.api, undefined)).resolves.toBeNull()
  })
})

describe('changing the email', () => {
  it('asks for a code at each address and sends both with the new address', async () => {
    const fake = fakeApi()
      .on('post', '/user/info/email/request', { uuid: 'current-id' })
      .on('post', '/auth/code/request', { uuid: 'new-id' })
      .on('post', '/user/info/email', undefined)
    await expect(requestCurrentEmailCode(fake.api)).resolves.toEqual({ codeId: 'current-id' })
    await expect(requestNewEmailCode(fake.api, { email: ' new@example.test ' })).resolves.toEqual({
      codeId: 'new-id',
    })
    await changeEmail(fake.api, {
      email: ' new@example.test ',
      currentId: 'current-id',
      currentCode: 'ABC123',
      newId: 'new-id',
      newCode: 'DEF456',
    })
    await expect(fake.requests[1]?.json()).resolves.toEqual({ email: 'new@example.test' })
    await expect(fake.requests[2]?.json()).resolves.toEqual({
      email: 'new@example.test',
      currentUuid: 'current-id',
      currentCode: 'ABC123',
      newUuid: 'new-id',
      newCode: 'DEF456',
    })
  })
})

describe('changePassword', () => {
  it('sends the old and the new password', async () => {
    const fake = fakeApi().on('post', '/user/info/password', undefined)
    await changePassword(fake.api, { oldPassword: 'old', password: 'new' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      old_password: 'old',
      password: 'new',
    })
  })
})

describe('passkeys', () => {
  it('starts a registration, finishes it with the credential and removes a passkey', async () => {
    const fake = fakeApi()
      .on('post', '/auth/passkey/register/options', { flow_id: 'f', options: { challenge: 'c' } })
      .on('post', '/auth/passkey/register/verify', {
        id: 3,
        name: 'MacBook',
        credential_id: 'abc',
        credential_backed_up: false,
        device_type: null,
        created: '2026-10-08T00:00:00Z',
      })
      .on('delete', '/auth/passkey/{id}', { id: 3 })
    await expect(startPasskey(fake.api, { name: ' MacBook ' })).resolves.toEqual({
      flowId: 'f',
      options: { challenge: 'c' },
    })
    await finishPasskey(fake.api, {
      flowId: 'f',
      name: ' MacBook ',
      credential: { id: 'abc', response: {} },
    })
    await removePasskey(fake.api, { id: 3 })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ name: 'MacBook' })
    await expect(fake.requests[1]?.json()).resolves.toEqual({
      flow_id: 'f',
      name: 'MacBook',
      response: { id: 'abc', response: {} },
    })
    expect(new URL(fake.requests[2]?.url ?? '').pathname).toBe('/auth/passkey/3')
  })
})

describe('connections', () => {
  it('unlinks an identity and links a PotatoVN account', async () => {
    const fake = fakeApi()
      .on('delete', '/auth/oidc/identities/{id}', undefined)
      .on('post', '/potatovn/binding', {
        pvn_user_id: 1,
        pvn_user_name: 'kotori',
        pvn_user_avatar: null,
        pvn_token_expires: '2026-12-01T00:00:00Z',
        created: '2026-10-08T00:00:00Z',
        updated: '2026-10-08T00:00:00Z',
      })
    await unlinkIdentity(fake.api, { id: 5 })
    await bindPotato(fake.api, { name: ' kotori ', password: 'secret' })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/auth/oidc/identities/5')
    await expect(fake.requests[1]?.json()).resolves.toEqual({
      pvn_user_name: 'kotori',
      pvn_password: 'secret',
    })
  })
})
