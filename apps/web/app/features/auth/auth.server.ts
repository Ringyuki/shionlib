import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import {
  emailCommand,
  passkeyAssertionCommand,
  passwordResetCommand,
  signInCommand,
  signUpCommand,
} from './auth.schema'
import {
  checkPasswordResetLink,
  finishPasskeySignIn,
  requestPasswordReset,
  requestSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  startPasskeySignIn,
} from './auth.use-cases'

export async function signInAction(args: ActionFunctionArgs) {
  const credentials = await readCommand(args, signInCommand)
  return routeAction(args, api => signIn(api, credentials))
}

export async function signUpAction(args: ActionFunctionArgs) {
  const registration = await readCommand(args, signUpCommand)
  return routeAction(args, api => signUp(api, registration))
}

export async function signUpCodeAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, emailCommand)
  return routeAction(args, api => requestSignUpCode(api, request))
}

export async function passwordResetRequestAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, emailCommand)
  return routeAction(args, api => requestPasswordReset(api, request))
}

export function passkeyOptionsAction(args: ActionFunctionArgs) {
  return routeAction(args, api => startPasskeySignIn(api))
}

export async function passkeySignInAction(args: ActionFunctionArgs) {
  const assertion = await readCommand(args, passkeyAssertionCommand)
  return routeAction(args, api => finishPasskeySignIn(api, assertion))
}

export function signOutAction(args: ActionFunctionArgs) {
  return routeAction(args, api => signOut(api))
}

export function passwordResetLoader(args: LoaderFunctionArgs) {
  const query = args.url.searchParams
  const token = query.get('token') ?? ''
  const email = query.get('email') ?? ''
  return routeLoader(args, async api => ({
    email,
    token,
    valid: token !== '' && email !== '' && (await checkPasswordResetLink(api, token, email)),
  }))
}

export async function passwordResetAction(args: ActionFunctionArgs) {
  const reset = await readCommand(args, passwordResetCommand)
  return routeAction(args, api => resetPassword(api, reset))
}
