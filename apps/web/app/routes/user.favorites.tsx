import { FavoriteShowcase } from '~/features/favorite'
import type { Route } from './+types/user.favorites'

export { showcaseLoader as loader } from '~/features/favorite/favorite.server'

export default function UserFavoritesRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <FavoriteShowcase showcase={loaderData} own={site.loaderData.viewer?.id === loaderData.owner} />
  )
}
