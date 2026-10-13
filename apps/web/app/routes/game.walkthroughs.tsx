import { WalkthroughTab } from '~/features/walkthrough'
import type { Route } from './+types/game.walkthroughs'

export { guidesLoader as loader } from '~/features/walkthrough/walkthrough.server'
export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export default function GameWalkthroughsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , game] = matches
  return (
    <WalkthroughTab
      guides={loaderData}
      credits={game.loaderData.characters}
      viewerId={site.loaderData.viewer?.id}
    />
  )
}
