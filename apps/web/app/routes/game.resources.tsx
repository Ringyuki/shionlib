import { ResourceList } from '~/features/resource'
import type { Route } from './+types/game.resources'

export default function GameResources({ matches }: Route.ComponentProps) {
  const [, , site, , game] = matches
  return (
    <ResourceList
      gameId={game.loaderData.header.id}
      resources={game.loaderData.resources}
      viewer={site.loaderData.viewer}
    />
  )
}
