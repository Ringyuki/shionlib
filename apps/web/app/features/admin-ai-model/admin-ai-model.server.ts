import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { catalogQueryFrom, filterFrom, modelCommand } from './admin-ai-model.schema'
import { changeModel, loadModel, loadModels, searchCatalog } from './admin-ai-model.use-cases'

export function aiModelsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams)
  return routeLoader(args, api => loadModels(api, filter))
}

export function aiModelLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadModel(api, id))
}

export async function aiModelAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, modelCommand)
  return routeAction(args, api => changeModel(api, change))
}

export function aiCatalogModelsLoader(args: LoaderFunctionArgs) {
  const query = catalogQueryFrom(args.url.searchParams.get('q'))
  return routeLazyLoader(args, api => searchCatalog(api, query))
}
