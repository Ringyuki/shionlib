import type { LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeLoader } from '~/shared/route/route.server'
import { pageSize } from './activity'
import { feedKindFrom } from './activity.schema'
import { loadFeed } from './activity.use-cases'

export async function feedLoader(args: LoaderFunctionArgs) {
  const kind = feedKindFrom(new URL(args.request.url).searchParams.get('kind'))
  const page = requestedPage(args.request)
  const feed = await routeLoader(args, api => loadFeed(api, kind, page))
  keepWithinPages(args.request, feed.total, pageSize)
  return feed
}
