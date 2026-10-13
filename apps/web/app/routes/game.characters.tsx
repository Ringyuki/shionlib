import { Cast } from '~/features/character'
import type { Route } from './+types/game.characters'

export default function GameCharactersRoute({ matches }: Route.ComponentProps) {
  const [, , , , game] = matches
  return <Cast credits={game.loaderData.characters} />
}
