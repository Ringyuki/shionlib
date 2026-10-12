import { redirect, type LoaderFunctionArgs } from 'react-router'
import type { AbstractIntlMessages } from 'use-intl'
import { routeLoader } from '~/shared/route/route.server'
import { adminAddress } from './admin'
import { trendRangeFrom } from './admin.schema'
import { loadOverview, loadPending } from './admin.use-cases'

export async function adminLoader<Texts extends AbstractIntlMessages>(
  args: LoaderFunctionArgs,
  loadMessages: () => Promise<Texts>,
) {
  const moved = adminAddress(args.url.pathname, args.url.search)
  if (moved !== undefined) {
    throw redirect(moved)
  }
  const [pending, messages] = await Promise.all([routeLoader(args, loadPending), loadMessages()])
  return { pending, messages }
}

export function overviewLoader(args: LoaderFunctionArgs) {
  const days = trendRangeFrom(args.url.searchParams.get('days'))
  return routeLoader(args, api => loadOverview(api, days))
}
