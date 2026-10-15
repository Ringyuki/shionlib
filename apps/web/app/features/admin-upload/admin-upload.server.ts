import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { searchWith } from './admin-upload'
import { filterFrom, uploadTerminationCommand } from './admin-upload.schema'
import { loadUploads, terminateUpload } from './admin-upload.use-cases'

export async function uploadsLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadUploads(api, filter, pageSize))
  if (filter.opened !== undefined && listing.opened === undefined) {
    throw redirect(`${args.url.pathname}${searchWith(args.url.search, undefined)}`)
  }
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function uploadTerminationAction(args: ActionFunctionArgs) {
  const termination = await readCommand(args, uploadTerminationCommand)
  return routeAction(args, api => terminateUpload(api, termination))
}
