import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { pageParam, recordSearchCommand } from './search.schema'
import {
  findGames,
  loadPalette,
  loadRecentReleases,
  recordSearch,
  searchGames,
} from './search.use-cases'

export function paletteLoader(args: LoaderFunctionArgs) {
  const query = new URL(args.request.url).searchParams.get('q') ?? ''
  return routeLoader(args, api => loadPalette(api, query))
}

export function gameOptionsLoader(args: LoaderFunctionArgs) {
  const query = new URL(args.request.url).searchParams.get('q') ?? ''
  return routeLoader(args, api => findGames(api, query))
}

export function recentReleasesLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, api => loadRecentReleases(api, new Date()))
}

export async function recordSearchAction(args: ActionFunctionArgs) {
  const { query } = await readCommand(args, recordSearchCommand)
  return routeAction(args, api => recordSearch(api, query))
}

export function searchResultsLoader(args: LoaderFunctionArgs) {
  const params = new URL(args.request.url).searchParams
  const query = params.get('q') ?? ''
  const page = pageParam(params.get('page'))
  return routeLoader(args, api => searchGames(api, query, page))
}

export function legacySearchRedirect({ request, params }: LoaderFunctionArgs) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const search = query === '' ? '' : `?${new URLSearchParams({ q: query })}`
  return redirect(`/${params.lang ?? ''}/search${search}`, 301)
}
