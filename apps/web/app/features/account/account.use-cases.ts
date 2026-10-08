import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { Connections, LinkResult, Security } from './account'
import type {
  EmailChange,
  NewEmailCode,
  PasskeyFinish,
  PasskeyStart,
  PasswordChange,
  PotatoSignIn,
  Removal,
} from './account.schema'

async function forViewer<Result>(request: Promise<Result>): Promise<Result | null> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

async function passkeys(api: ApiClient): Promise<Security> {
  return { passkeys: (await api.get('/auth/passkey')) ?? [] }
}

export function loadSecurity(api: ApiClient): Promise<Security | null> {
  return forViewer(passkeys(api))
}

export async function requestCurrentEmailCode(api: ApiClient) {
  const { uuid } = await api.post('/user/info/email/request')
  return { codeId: uuid }
}

export async function requestNewEmailCode(api: ApiClient, { email }: NewEmailCode) {
  const { uuid } = await api.post('/auth/code/request', { body: { email: email.trim() } })
  return { codeId: uuid }
}

export async function changeEmail(api: ApiClient, change: EmailChange) {
  await api.post('/user/info/email', {
    body: {
      email: change.email.trim(),
      currentUuid: change.currentId,
      currentCode: change.currentCode,
      newUuid: change.newId,
      newCode: change.newCode,
    },
  })
  return null
}

export async function changePassword(api: ApiClient, change: PasswordChange) {
  await api.post('/user/info/password', {
    body: { old_password: change.oldPassword, password: change.password },
  })
  return null
}

export async function startPasskey(api: ApiClient, { name }: PasskeyStart) {
  const flow = await api.post('/auth/passkey/register/options', { body: { name: name.trim() } })
  return { flowId: flow.flow_id, options: flow.options }
}

export async function finishPasskey(api: ApiClient, finish: PasskeyFinish) {
  await api.post('/auth/passkey/register/verify', {
    body: { flow_id: finish.flowId, name: finish.name.trim(), response: finish.credential },
  })
  return null
}

export async function removePasskey(api: ApiClient, { id }: Removal) {
  await api.delete('/auth/passkey/{id}', { params: { path: { id } } })
  return null
}

async function potatoBinding(api: ApiClient) {
  try {
    return await api.get('/potatovn/binding')
  } catch (error) {
    if (error instanceof ApiError && error.is('PVN_BINDING_NOT_FOUND')) {
      return null
    }
    throw error
  }
}

async function connections(
  api: ApiClient,
  linkResult: LinkResult | undefined,
): Promise<Connections> {
  const [identities, potato] = await Promise.all([
    api.get('/auth/oidc/identities'),
    potatoBinding(api),
  ])
  return { identities, potato, linkResult }
}

export function loadConnections(
  api: ApiClient,
  linkResult: LinkResult | undefined,
): Promise<Connections | null> {
  return forViewer(connections(api, linkResult))
}

export async function unlinkIdentity(api: ApiClient, { id }: Removal) {
  await api.delete('/auth/oidc/identities/{id}', { params: { path: { id } } })
  return null
}

export async function bindPotato(api: ApiClient, request: PotatoSignIn) {
  await api.post('/potatovn/binding', {
    body: { pvn_user_name: request.name.trim(), pvn_password: request.password },
  })
  return null
}

export async function unbindPotato(api: ApiClient) {
  await api.delete('/potatovn/binding')
  return null
}
