import { GameInfo } from '~/features/game'
import type { Route } from './+types/game.info'

export default function GameInfoRoute({ matches }: Route.ComponentProps) {
  const [, , , game] = matches
  return <GameInfo details={game.loaderData.details} entry={game.loaderData.header.h_id} />
}
