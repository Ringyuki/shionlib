import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  type EmailOnly,
  type PasskeyAssertion,
  type PasswordReset,
  type SignIn,
  type SignUp,
} from './auth'

export async function signIn(api: ApiClient, command: SignIn) {
  return api.post('/user/login', {
    body: { identifier: command.identifier.trim(), password: command.password },
  })
}

export async function signUp(api: ApiClient, command: SignUp) {
  const email = command.email.trim()
  await api.post('/user', {
    body: {
      name: command.name.trim(),
      email,
      password: command.password,
      code: command.code,
      uuid: command.codeId,
      lang: command.locale,
    },
  })
  return signIn(api, { identifier: email, password: command.password })
}

export async function requestSignUpCode(api: ApiClient, command: EmailOnly) {
  const { uuid } = await api.post('/auth/code/request', { body: { email: command.email.trim() } })
  return { codeId: uuid }
}

export async function requestPasswordReset(api: ApiClient, command: EmailOnly) {
  await api.post('/auth/password/forget', { body: { email: command.email.trim() } })
  return null
}

export async function startPasskeySignIn(api: ApiClient) {
  const flow = await api.post('/auth/passkey/login/options', { body: {} })
  return { flowId: flow.flow_id, options: flow.options }
}

export async function finishPasskeySignIn(api: ApiClient, assertion: PasskeyAssertion) {
  return api.post('/auth/passkey/login/verify', {
    body: { flow_id: assertion.flowId, response: assertion.credential },
  })
}

export async function signOut(api: ApiClient) {
  await api.post('/auth/logout')
  return null
}

export async function checkPasswordResetLink(api: ApiClient, token: string, email: string) {
  try {
    return await api.post('/auth/password/forget/check', { body: { token, email } })
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      return false
    }
    throw error
  }
}

export async function resetPassword(api: ApiClient, command: PasswordReset) {
  await api.post('/auth/password/forget/reset', {
    body: { token: command.token, email: command.email, password: command.password },
  })
  return null
}
