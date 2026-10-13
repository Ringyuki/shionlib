import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { searchWith } from './admin-walkthrough'
import { filterFrom, walkthroughCommand } from './admin-walkthrough.schema'
import { changeWalkthrough, loadWalkthroughs } from './admin-walkthrough.use-cases'

export async function walkthroughsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadWalkthroughs(api, filter, pageSize))
  if (filter.opened !== undefined && listing.opened === undefined) {
    throw redirect(`${args.url.pathname}${searchWith(args.url.search, undefined)}`)
  }
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function walkthroughAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, walkthroughCommand)
  return routeAction(args, api => changeWalkthrough(api, change))
}
