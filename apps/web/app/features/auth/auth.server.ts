import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { routeAction, routeLoader } from '~/shared/route/route.server'
import {
  parseEmailOnly,
  parsePasskeyAssertion,
  parsePasswordReset,
  parseSignIn,
  parseSignUp,
} from './auth'
import {
  checkPasswordResetLink,
  finishPasskeySignIn,
  loadArtwork,
  requestPasswordReset,
  requestSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  startPasskeySignIn,
} from './auth.use-cases'

async function command<Command>(
  args: ActionFunctionArgs,
  parse: (value: unknown) => Command | undefined,
): Promise<Command> {
  const parsed = parse(await args.request.json().catch(() => undefined))
  if (parsed === undefined) {
    throw data(null, { status: 400 })
  }
  return parsed
}

export async function signInAction(args: ActionFunctionArgs) {
  const credentials = await command(args, parseSignIn)
  return routeAction(args, api => signIn(api, credentials))
}

export async function signUpAction(args: ActionFunctionArgs) {
  const registration = await command(args, parseSignUp)
  return routeAction(args, api => signUp(api, registration))
}

export async function signUpCodeAction(args: ActionFunctionArgs) {
  const request = await command(args, parseEmailOnly)
  return routeAction(args, api => requestSignUpCode(api, request))
}

export async function passwordResetRequestAction(args: ActionFunctionArgs) {
  const request = await command(args, parseEmailOnly)
  return routeAction(args, api => requestPasswordReset(api, request))
}

export function passkeyOptionsAction(args: ActionFunctionArgs) {
  return routeAction(args, api => startPasskeySignIn(api))
}

export async function passkeySignInAction(args: ActionFunctionArgs) {
  const assertion = await command(args, parsePasskeyAssertion)
  return routeAction(args, api => finishPasskeySignIn(api, assertion))
}

export function signOutAction(args: ActionFunctionArgs) {
  return routeAction(args, api => signOut(api))
}

export function artworkLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, api => loadArtwork(api, Math.random))
}

export function passwordResetLoader(args: LoaderFunctionArgs) {
  const query = new URL(args.request.url).searchParams
  const token = query.get('token') ?? ''
  const email = query.get('email') ?? ''
  return routeLoader(args, async api => ({
    email,
    token,
    valid: token !== '' && email !== '' && (await checkPasswordResetLink(api, token, email)),
  }))
}

export async function passwordResetAction(args: ActionFunctionArgs) {
  const reset = await command(args, parsePasswordReset)
  return routeAction(args, api => resetPassword(api, reset))
}
