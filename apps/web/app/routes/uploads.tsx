import { UploaderPage, listingFrom, loadUploader, pageSize } from '~/features/uploader'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/uploads'

export async function loader(args: Route.LoaderArgs) {
  const listing = listingFrom(args.url.searchParams, requestedPage(args.url))
  const content = await routeLoader(args, api => loadUploader(api, listing))
  if (content !== null) {
    keepWithinPages(args.url, content.total, pageSize)
  }
  return content
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.uploader.title, indexable: false })
}

export default function Uploads({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <UploaderPage content={loaderData} viewer={site.loaderData.viewer} />
}
