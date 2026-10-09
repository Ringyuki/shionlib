import { ResourceList } from '~/features/resource'
import type { Route } from './+types/game.resources'

export default function GameResources({ matches }: Route.ComponentProps) {
  const [, , site, , game] = matches
  return (
    <ResourceList
      game={game.loaderData.header}
      resources={game.loaderData.resources}
      viewer={site.loaderData.viewer}
    />
  )
}
