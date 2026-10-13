import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeAction, routeLoader } from '~/shared/route/route.server'
import { openedParam, pageSize } from './message'
import { categoryFrom, openedFrom } from './message.schema'
import { loadInbox, markAllRead } from './message.use-cases'

export async function inboxLoader(args: LoaderFunctionArgs) {
  const category = categoryFrom(args.params.category)
  if (category === undefined) {
    throw data(null, { status: 404 })
  }
  const page = requestedPage(args.url)
  const opened = openedFrom(args.url.searchParams.get(openedParam))
  const inbox = await routeLoader(args, api => loadInbox(api, category, page, opened))
  if (inbox !== null) {
    keepWithinPages(args.url, inbox.total, pageSize)
  }
  return inbox
}

export function markAllReadAction(args: ActionFunctionArgs) {
  return routeAction(args, markAllRead)
}
