import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import {
  emailCommand,
  linkResultFrom,
  newEmailCodeCommand,
  passkeyFinishCommand,
  passkeyStartCommand,
  passwordCommand,
  potatoBindingCommand,
  removalCommand,
} from './account.schema'
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
  unbindPotato,
  unlinkIdentity,
} from './account.use-cases'

export function securityLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadSecurity)
}

export function connectionsLoader(args: LoaderFunctionArgs) {
  const result = linkResultFrom(new URL(args.request.url).searchParams)
  return routeLoader(args, api => loadConnections(api, result))
}

export function currentEmailCodeAction(args: ActionFunctionArgs) {
  return routeAction(args, requestCurrentEmailCode)
}

export async function newEmailCodeAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, newEmailCodeCommand)
  return routeAction(args, api => requestNewEmailCode(api, request))
}

export async function emailAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, emailCommand)
  return routeAction(args, api => changeEmail(api, change))
}

export async function passwordAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, passwordCommand)
  return routeAction(args, api => changePassword(api, change))
}

export async function passkeyStartAction(args: ActionFunctionArgs) {
  const start = await readCommand(args, passkeyStartCommand)
  return routeAction(args, api => startPasskey(api, start))
}

export async function passkeyFinishAction(args: ActionFunctionArgs) {
  const finish = await readCommand(args, passkeyFinishCommand)
  return routeAction(args, api => finishPasskey(api, finish))
}

export async function passkeyRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, removalCommand)
  return routeAction(args, api => removePasskey(api, removal))
}

export async function identityRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, removalCommand)
  return routeAction(args, api => unlinkIdentity(api, removal))
}

export async function potatoBindingAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, potatoBindingCommand)
  return routeAction(args, api => bindPotato(api, request))
}

export function potatoUnbindingAction(args: ActionFunctionArgs) {
  return routeAction(args, unbindPotato)
}
