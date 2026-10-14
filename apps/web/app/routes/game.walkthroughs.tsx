import { WalkthroughTab, walkthroughHead } from '~/features/walkthrough'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/game.walkthroughs'

export { guidesLoader as loader } from '~/features/walkthrough/walkthrough.server'
export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , game] = args.matches
  return pageMeta(
    args,
    args.loaderData && walkthroughHead(args.loaderData, game.loaderData.header, lang.loaderData),
  )
}

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
