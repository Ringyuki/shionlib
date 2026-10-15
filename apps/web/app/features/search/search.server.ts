import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { resourceRuleFrom } from '~/features/game'
import { pageParam } from '~/shared/route/params'
import {
  readCommand,
  readForm,
  routeAction,
  routeLazyLoader,
  routeLoader,
} from '~/shared/route/route.server'
import { imageSearchCommand, recordSearchCommand } from './search.schema'
import {
  findGames,
  loadPalette,
  loadRecentReleases,
  recordSearch,
  searchByImage,
  searchGames,
} from './search.use-cases'

export function paletteLoader(args: LoaderFunctionArgs) {
  const query = args.url.searchParams.get('q') ?? ''
  return routeLazyLoader(args, api => loadPalette(api, query))
}

export function gameOptionsLoader(args: LoaderFunctionArgs) {
  const query = args.url.searchParams.get('q') ?? ''
  return routeLazyLoader(args, api => findGames(api, query))
}

export function recentReleasesLoader(args: LoaderFunctionArgs) {
  return routeLazyLoader(args, api => loadRecentReleases(api, new Date()))
}

export async function recordSearchAction(args: ActionFunctionArgs) {
  const { query } = await readCommand(args, recordSearchCommand)
  return routeAction(args, api => recordSearch(api, query))
}

export async function imageSearchAction(args: ActionFunctionArgs) {
  const { image } = await readForm(args, imageSearchCommand)
  return routeAction(args, api => searchByImage(api, image))
}

export function searchResultsLoader(args: LoaderFunctionArgs) {
  const params = args.url.searchParams
  const query = params.get('q') ?? ''
  const page = pageParam(params.get('page'))
  const resources = resourceRuleFrom(params.get('resources'))
  return routeLoader(args, api => searchGames(api, query, page, resources))
}

export function legacySearchRedirect({ url, params }: LoaderFunctionArgs) {
  const query = url.searchParams.get('q') ?? ''
  const search = query === '' ? '' : `?${new URLSearchParams({ q: query })}`
  return redirect(`/${params.lang ?? ''}/search${search}`, 301)
}
