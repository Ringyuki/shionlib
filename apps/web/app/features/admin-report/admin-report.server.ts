import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { searchWith } from './admin-report'
import { filterFrom, reviewCommand } from './admin-report.schema'
import { loadReports, reviewReport } from './admin-report.use-cases'

export async function reportsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadReports(api, filter, pageSize))
  if (filter.opened !== undefined && listing.opened === undefined) {
    throw redirect(`${args.url.pathname}${searchWith(args.url.search, undefined)}`)
  }
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function reviewReportAction(args: ActionFunctionArgs) {
  const review = await readCommand(args, reviewCommand)
  return routeAction(args, api => reviewReport(api, review))
}
