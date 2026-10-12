import { GamesPage } from '~/features/admin-game'
import type { Route } from './+types/admin.games'

export { gamesLoader as loader } from '~/features/admin-game/admin-game.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminGame.title} | Shionlib` }]
}

export default function AdminGames({ loaderData }: Route.ComponentProps) {
  return <GamesPage {...loaderData} />
}
