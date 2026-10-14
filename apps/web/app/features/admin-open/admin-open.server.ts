import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { filterFrom, openCommand } from './admin-open.schema'
import { changeOpen, loadOpen } from './admin-open.use-cases'

export async function openLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadOpen(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function openAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, openCommand)
  return routeAction(args, api => changeOpen(api, change))
}
