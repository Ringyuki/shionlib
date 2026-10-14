import { GamesPage } from '~/features/admin-game'
import type { Route } from './+types/admin.games'
import { pageMeta } from '~/shared/seo/seo'

export { gamesLoader as loader } from '~/features/admin-game/admin-game.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminGame.title, indexable: false })
}

export default function AdminGames({ loaderData }: Route.ComponentProps) {
  return <GamesPage {...loaderData} />
}
