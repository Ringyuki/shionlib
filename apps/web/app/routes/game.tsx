import { FavoriteButton, isFavorite } from '~/features/favorite'
import { GameHeader, gameTitle, loadGameHeader } from '~/features/game'
import { isLocale } from '~/shared/i18n/locale'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/game'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => {
    const [game, favorited] = await Promise.all([loadGameHeader(api, id), isFavorite(api, id)])
    return { game, favorited }
  })
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (loaderData === undefined || !isLocale(params.lang)) {
    return []
  }
  return [{ title: `${gameTitle(loaderData.game, params.lang)} | Shionlib` }]
}

export default function GameRoute({ loaderData }: Route.ComponentProps) {
  return (
    <GameHeader
      game={loaderData.game}
      actions={<FavoriteButton gameId={loaderData.game.id} favorited={loaderData.favorited} />}
    />
  )
}
