import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { keyCommand } from './api-key.schema'
import { changeKey, loadKeys } from './api-key.use-cases'

export function apiKeysLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadKeys)
}

export async function apiKeyAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, keyCommand)
  return routeAction(args, api => changeKey(api, change))
}
