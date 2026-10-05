import { GameCharacters } from '~/features/game'
import type { Route } from './+types/game.characters'

export default function GameCharactersRoute({ matches }: Route.ComponentProps) {
  const [, , , game] = matches
  return <GameCharacters characters={game.loaderData.characters} />
}
