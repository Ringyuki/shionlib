import { loadResourceEvents, ResourceHistory } from '~/features/resource'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/resource.history'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadResourceEvents(api, id))
}

export default function ResourceHistoryRoute({ loaderData }: Route.ComponentProps) {
  return <ResourceHistory events={loaderData} />
}
