import type { ActionFunctionArgs } from 'react-router'
import { readCommand, routeAction } from '~/shared/route/route.server'
import { routeCommand } from './admin-ai-route.schema'
import { changeRoute } from './admin-ai-route.use-cases'

export async function aiRouteAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, routeCommand)
  return routeAction(args, api => changeRoute(api, change))
}
