import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { filterFrom, sponsorCommand } from './admin-sponsor.schema'
import { changeOrder, loadSponsors } from './admin-sponsor.use-cases'

export async function sponsorsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadSponsors(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function sponsorAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, sponsorCommand)
  return routeAction(args, api => changeOrder(api, change))
}
