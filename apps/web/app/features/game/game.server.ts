import type { ActionFunctionArgs } from 'react-router'
import { readCommand, routeAction } from '~/shared/route/route.server'
import { viewCommand } from './game.schema'
import { countView } from './game.use-cases'

export async function countViewAction(args: ActionFunctionArgs) {
  const { gameId } = await readCommand(args, viewCommand)
  return routeAction(args, api => countView(api, gameId))
}
