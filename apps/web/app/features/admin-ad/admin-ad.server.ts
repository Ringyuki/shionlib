import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, readForm, routeAction, routeLoader } from '~/shared/route/route.server'
import { adCommand, filterFrom, imageCommand } from './admin-ad.schema'
import { changeAd, loadAds, loadSlots, uploadImage } from './admin-ad.use-cases'

export async function adsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadAds(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export function adSlotsLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadSlots)
}

export async function adAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, adCommand)
  return routeAction(args, api => changeAd(api, change))
}

export async function adImageAction(args: ActionFunctionArgs) {
  const { kind, image } = await readForm(args, imageCommand)
  return routeAction(args, api => uploadImage(api, kind, image))
}
