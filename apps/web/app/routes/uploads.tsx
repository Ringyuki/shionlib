import { redirect } from 'react-router'
import {
  UploaderPage,
  lastPage,
  listingFrom,
  listingSearch,
  loadUploader,
} from '~/features/uploader'
import { pageParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/uploads'

export async function loader(args: Route.LoaderArgs) {
  const url = new URL(args.request.url)
  const listing = listingFrom(url.searchParams, pageParam(url.searchParams.get('page')))
  const content = await routeLoader(args, api => loadUploader(api, listing))
  if (content !== null && listing.page > lastPage(content.total)) {
    throw redirect(`${url.pathname}${listingSearch({ ...listing, page: lastPage(content.total) })}`)
  }
  return content
}

export default function Uploads({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <UploaderPage content={loaderData} viewer={site.loaderData.viewer} />
}
