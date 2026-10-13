import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { rangeFrom, sceneCommand } from './admin-ai.schema'
import { loadOverview, loadScenes, saveScene } from './admin-ai.use-cases'

export function aiOverviewLoader(args: LoaderFunctionArgs) {
  const range = rangeFrom(args.url.searchParams.get('range'))
  return routeLoader(args, api => loadOverview(api, range))
}

export function aiScenesLoader(args: LoaderFunctionArgs) {
  const opened = args.url.searchParams.get('scene')
  return routeLoader(args, api => loadScenes(api, opened))
}

export async function aiSceneAction(args: ActionFunctionArgs) {
  const save = await readCommand(args, sceneCommand)
  return routeAction(args, api => saveScene(api, save))
}
