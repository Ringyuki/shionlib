import { Cast } from '~/features/character'
import { gameHead } from '~/features/game'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/game.characters'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , game] = args.matches
  return pageMeta(args, gameHead(game.loaderData, lang.loaderData, 'characters'))
}

export default function GameCharactersRoute({ matches }: Route.ComponentProps) {
  const [, , , , game] = matches
  return <Cast credits={game.loaderData.characters} />
}
