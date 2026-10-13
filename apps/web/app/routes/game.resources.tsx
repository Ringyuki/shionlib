import { loadMoyuEntries, ResourceList } from '~/features/resource'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/game.resources'

export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadMoyuEntries(api, id))
}

export default function GameResources({ matches, loaderData }: Route.ComponentProps) {
  const [, , site, , game] = matches
  return (
    <ResourceList
      game={game.loaderData.header}
      resources={game.loaderData.resources}
      entries={loaderData}
      viewer={site.loaderData.viewer}
    />
  )
}
