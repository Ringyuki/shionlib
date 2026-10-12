import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { playgroundCommand } from './admin-ai-playground.schema'
import { loadChoices, runPlayground } from './admin-ai-playground.use-cases'

export function aiPlaygroundLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadChoices)
}

export async function aiPlaygroundAction(args: ActionFunctionArgs) {
  const run = await readCommand(args, playgroundCommand)
  return routeAction(args, api => runPlayground(api, run))
}
