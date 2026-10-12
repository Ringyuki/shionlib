import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { filterFrom, kindFrom, providerCommand } from './admin-ai-provider.schema'
import {
  changeProvider,
  loadEndpoint,
  loadPresets,
  loadProvider,
  loadProviders,
  loadResolved,
} from './admin-ai-provider.use-cases'

export function aiProvidersLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams)
  return routeLoader(args, api => loadProviders(api, filter))
}

export function aiProviderLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadProvider(api, id))
}

export async function aiProviderAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, providerCommand)
  return routeAction(args, api => changeProvider(api, change))
}

export function aiPresetsLoader(args: LoaderFunctionArgs) {
  return routeLazyLoader(args, loadPresets)
}

export function aiEndpointLoader(args: LoaderFunctionArgs) {
  const kind = kindFrom(args.url.searchParams.get('kind'))
  if (kind === undefined) {
    throw data(null, { status: 404 })
  }
  const baseUrl = args.url.searchParams.get('base_url') ?? ''
  return routeLazyLoader(args, api => loadEndpoint(api, kind, baseUrl))
}

export function aiResolveLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.url.searchParams.get('provider') ?? undefined)
  const upstreamId = args.url.searchParams.get('upstream') ?? ''
  return routeLazyLoader(args, api => loadResolved(api, id, upstreamId))
}
