import { Outlet } from 'react-router'
import { adPage, adsIn, AdSlot, DownloadBanner, loadPlacements } from '~/features/ad'
import { loadResourcePage, ResourcePage, resourceHead } from '~/features/resource'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/resource'

export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export const handle = adPage

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => {
    const [page, ads] = await Promise.all([
      loadResourcePage(api, id),
      loadPlacements(api, args.params.lang, ['resource', 'download']),
    ])
    return { ...page, ads }
  })
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && resourceHead(args.loaderData, lang.loaderData))
}

export default function ResourceRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <ResourcePage
      page={loaderData}
      viewer={site.loaderData.viewer}
      banner={<AdSlot slot="resource" ads={adsIn(loaderData.ads, 'resource')} />}
      downloadBanner={<DownloadBanner ads={adsIn(loaderData.ads, 'download')} />}
    >
      <Outlet />
    </ResourcePage>
  )
}
