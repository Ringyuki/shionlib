import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { owned, sponsorPaths, wallPageSize } from './sponsor'
import { orderCommand, payCommand, tokenFrom } from './sponsor.schema'
import { createOrder, loadOrder, loadState, loadWall, payOrder } from './sponsor.use-cases'

export async function wallLoader(args: LoaderFunctionArgs) {
  const wall = await routeLoader(args, api => loadWall(api, requestedPage(args.url)))
  keepWithinPages(args.url, wall.total, wallPageSize)
  return wall
}

export async function checkoutLoader(args: LoaderFunctionArgs) {
  const state = await routeLoader(args, loadState)
  if (!state.enabled) {
    throw redirect(sponsorPaths(isLocale(args.params.lang) ? args.params.lang : defaultLocale).wall)
  }
  return { state, now: new Date().toISOString() }
}

export async function orderLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const page = await routeLoader(args, api => loadOrder(api, id, tokenFrom(args.url.searchParams)))
  if (!owned(page.view)) {
    throw data(null, { status: 404 })
  }
  return { page, now: new Date().toISOString() }
}

export async function orderCreationAction(args: ActionFunctionArgs) {
  const draft = await readCommand(args, orderCommand)
  return routeAction(args, api => createOrder(api, draft))
}

export async function payAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, payCommand)
  return routeAction(args, api => payOrder(api, request))
}
