import { UploaderPage, listingFrom, loadUploader, pageSize } from '~/features/uploader'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/uploads'

export async function loader(args: Route.LoaderArgs) {
  const listing = listingFrom(new URL(args.request.url).searchParams, requestedPage(args.request))
  const content = await routeLoader(args, api => loadUploader(api, listing))
  if (content !== null) {
    keepWithinPages(args.request, content.total, pageSize)
  }
  return content
}

export default function Uploads({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <UploaderPage content={loaderData} viewer={site.loaderData.viewer} />
}
