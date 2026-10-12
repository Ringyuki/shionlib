import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { excludedShown } from './admin-catalog'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { catalogCommand, lookupFrom } from './admin-catalog.schema'
import { changeCatalog, loadCatalog, searchSource } from './admin-catalog.use-cases'

export async function catalogLoader(args: LoaderFunctionArgs) {
  const page = requestedPage(args.url)
  const loaded = await routeLoader(args, api => loadCatalog(api, page))
  keepWithinPages(args.url, loaded.excludedTotal, excludedShown)
  return loaded
}

export async function catalogAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, catalogCommand)
  return routeAction(args, api => changeCatalog(api, change))
}

export function catalogSearchLoader(args: LoaderFunctionArgs) {
  const lookup = lookupFrom(args.url.searchParams)
  if (lookup.source === '' || lookup.query === '') {
    throw data(null, { status: 404 })
  }
  return routeLazyLoader(args, api => searchSource(api, lookup))
}
