import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { searchWith } from './admin-comment'
import { commentCommand, filterFrom } from './admin-comment.schema'
import { changeComments, loadComments } from './admin-comment.use-cases'

export async function commentsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadComments(api, filter, pageSize))
  if (filter.opened !== undefined && listing.opened === undefined) {
    throw redirect(`${args.url.pathname}${searchWith(args.url.search, undefined)}`)
  }
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function commentAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, commentCommand)
  return routeAction(args, api => changeComments(api, change))
}
