import type { LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeLoader } from '~/shared/route/route.server'
import { pageSize } from './activity'
import { feedKindFrom } from './activity.schema'
import { loadFeed } from './activity.use-cases'

export async function feedLoader(args: LoaderFunctionArgs) {
  const kind = feedKindFrom(args.url.searchParams.get('kind'))
  const page = requestedPage(args.url)
  const feed = await routeLoader(args, api => loadFeed(api, kind, page))
  keepWithinPages(args.url, feed.total, pageSize)
  return feed
}
