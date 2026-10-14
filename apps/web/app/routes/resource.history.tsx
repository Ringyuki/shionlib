import { loadResourceEvents, ResourceHistory, resourceHead } from '~/features/resource'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/resource.history'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadResourceEvents(api, id))
}

export function meta(args: Route.MetaArgs) {
  const [, lang, , , resource] = args.matches
  return pageMeta(args, resourceHead(resource.loaderData, lang.loaderData, 'history'))
}

export default function ResourceHistoryRoute({ loaderData }: Route.ComponentProps) {
  return <ResourceHistory events={loaderData} />
}
