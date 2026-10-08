import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { pageParam } from '~/shared/route/params'
import { routeAction, routeLoader } from '~/shared/route/route.server'
import { inboxPath, lastPage, openedParam } from './message'
import { categoryFrom, openedFrom } from './message.schema'
import { loadInbox, markAllRead } from './message.use-cases'

export async function inboxLoader(args: LoaderFunctionArgs) {
  const category = categoryFrom(args.params.category)
  if (category === undefined) {
    throw data(null, { status: 404 })
  }
  const params = new URL(args.request.url).searchParams
  const page = pageParam(params.get('page'))
  const opened = openedFrom(params.get(openedParam))
  const inbox = await routeLoader(args, api => loadInbox(api, category, page, opened))
  if (inbox !== null && page > lastPage(inbox.total)) {
    const locale = isLocale(args.params.lang) ? args.params.lang : defaultLocale
    throw redirect(inboxPath(locale, { category, page: lastPage(inbox.total), opened }))
  }
  return inbox
}

export function markAllReadAction(args: ActionFunctionArgs) {
  return routeAction(args, markAllRead)
}
