import { MyFavoritesPage } from '~/features/favorite'
import type { Route } from './+types/favorites'
import { pageMeta } from '~/shared/seo/seo'

export { favoritesLoader as loader } from '~/features/favorite/favorite.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.favorite.mine, indexable: false })
}

export default function FavoritesRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <MyFavoritesPage favorites={loaderData} signedIn={site.loaderData.viewer !== null} />
}
