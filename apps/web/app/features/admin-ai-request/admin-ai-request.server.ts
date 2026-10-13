import type { LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeLoader } from '~/shared/route/route.server'
import { filterFrom } from './admin-ai-request.schema'
import { loadRequests } from './admin-ai-request.use-cases'

export async function aiRequestsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadRequests(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}
