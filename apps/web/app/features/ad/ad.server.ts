import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { slotFrom, viewsCommand } from './ad.schema'
import { clickThrough, recordViews } from './ad.use-cases'

export async function viewsAction(args: ActionFunctionArgs) {
  const { views } = await readCommand(args, viewsCommand)
  return routeAction(args, api => recordViews(api, views))
}

export async function outLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const slot = slotFrom(args.url.searchParams)
  if (slot === undefined) {
    throw data(null, { status: 404 })
  }
  const link = await routeLoader(args, api => clickThrough(api, id, slot))
  return redirect(link, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}
