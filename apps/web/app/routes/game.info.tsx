import { GameInfo, gameHead } from '~/features/game'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/game.info'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , game] = args.matches
  return pageMeta(args, gameHead(game.loaderData, lang.loaderData, 'info'))
}

export default function GameInfoRoute({ matches }: Route.ComponentProps) {
  const [, , , , game] = matches
  return <GameInfo details={game.loaderData.details} entry={game.loaderData.header.h_id} />
}
