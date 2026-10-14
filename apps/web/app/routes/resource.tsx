import { Outlet } from 'react-router'
import { loadResourcePage, ResourcePage, resourceHead } from '~/features/resource'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/resource'

export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadResourcePage(api, id))
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && resourceHead(args.loaderData, lang.loaderData))
}

export default function ResourceRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <ResourcePage page={loaderData} viewer={site.loaderData.viewer}>
      <Outlet />
    </ResourcePage>
  )
}
