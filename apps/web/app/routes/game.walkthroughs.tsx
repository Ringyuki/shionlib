import { WalkthroughList } from '~/features/walkthrough'
import type { Route } from './+types/game.walkthroughs'

export { walkthroughsLoader as loader } from '~/features/walkthrough/walkthrough.server'

export default function GameWalkthroughsRoute({ loaderData }: Route.ComponentProps) {
  return <WalkthroughList walkthroughs={loaderData} />
}
