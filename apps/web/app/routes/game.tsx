import { Outlet } from 'react-router'
import { adPage, adsIn, AdSlot, loadPlacements } from '~/features/ad'
import { countComments } from '~/features/comment'
import { FavoriteButton, isFavorite } from '~/features/favorite'
import { GamePage, gameHead, loadGamePage, loadScores } from '~/features/game'
import { loadGameResources, summarizeResources } from '~/features/resource'
import { countWalkthroughs } from '~/features/walkthrough'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/game'

export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export const handle = adPage

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => {
    const [page, favorited, resources, commentCount, walkthroughCount, ads] = await Promise.all([
      loadGamePage(api, id),
      isFavorite(api, id),
      loadGameResources(api, id),
      countComments(api, id),
      countWalkthroughs(api, id),
      loadPlacements(api, args.params.lang, ['game', 'download']),
    ])
    return {
      ...page,
      favorited,
      resources,
      commentCount,
      walkthroughCount,
      ads,
      scores: loadScores(api, page.header),
    }
  })
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && gameHead(args.loaderData, lang.loaderData))
}

export default function GameRoute({ loaderData }: Route.ComponentProps) {
  const { header, details, characters, scores, resources, favorited, ads } = loaderData
  const { commentCount, walkthroughCount } = loaderData
  return (
    <GamePage
      header={header}
      details={details}
      characterCount={characters.length}
      commentCount={commentCount}
      walkthroughCount={walkthroughCount}
      scores={scores}
      resources={summarizeResources(resources)}
      favorite={<FavoriteButton gameId={header.id} favorited={favorited} />}
      banner={<AdSlot slot="game" ads={adsIn(ads, 'game')} />}
    >
      <Outlet />
    </GamePage>
  )
}
