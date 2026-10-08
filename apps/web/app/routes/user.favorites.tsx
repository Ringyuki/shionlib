import { FavoritesView } from '~/features/favorite'
import type { Route } from './+types/user.favorites'

export { favoritesLoader as loader } from '~/features/favorite/favorite.server'

export default function UserFavoritesRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <FavoritesView favorites={loaderData} own={site.loaderData.viewer?.id === loaderData.owner} />
  )
}
