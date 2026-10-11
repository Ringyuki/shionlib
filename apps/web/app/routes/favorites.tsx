import { MyFavoritesPage } from '~/features/favorite'
import type { Route } from './+types/favorites'

export { favoritesLoader as loader } from '~/features/favorite/favorite.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.favorite.mine} | Shionlib` }]
}

export default function FavoritesRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <MyFavoritesPage favorites={loaderData} signedIn={site.loaderData.viewer !== null} />
}
