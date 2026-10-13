import type { ActionFunctionArgs } from 'react-router'
import { readCommand, routeAction } from '~/shared/route/route.server'
import { preferenceCommand } from './viewer.schema'
import { savePreferences } from './viewer.use-cases'

export async function preferencesAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, preferenceCommand)
  return routeAction(args, api => savePreferences(api, change))
}
