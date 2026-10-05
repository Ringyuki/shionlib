import { Outlet } from 'react-router'
import { FavoriteButton, isFavorite } from '~/features/favorite'
import { GamePage, gameDescription, gameTitle, loadGamePage, loadScores } from '~/features/game'
import { loadGameResources, summarizeResources } from '~/features/resource'
import { isLocale } from '~/shared/i18n/locale.schema'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/game'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => {
    const [page, favorited, resources] = await Promise.all([
      loadGamePage(api, id),
      isFavorite(api, id),
      loadGameResources(api, id),
    ])
    return { ...page, favorited, resources, scores: loadScores(api, page.header) }
  })
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (loaderData === undefined || !isLocale(params.lang)) {
    return []
  }
  return [
    { title: `${gameTitle(loaderData.header, params.lang)} | Shionlib` },
    { name: 'description', content: gameDescription(loaderData.details, params.lang) },
  ]
}

export default function GameRoute({ loaderData }: Route.ComponentProps) {
  const { header, characters, scores, resources, favorited } = loaderData
  return (
    <GamePage
      header={header}
      characters={characters}
      scores={scores}
      resources={summarizeResources(resources)}
      favorite={<FavoriteButton gameId={header.id} favorited={favorited} />}
    >
      <Outlet />
    </GamePage>
  )
}
