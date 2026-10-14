import { FavoriteShowcase } from '~/features/favorite'
import { profileHead } from '~/features/profile'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/user.favorites'

export { showcaseLoader as loader } from '~/features/favorite/favorite.server'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , user] = args.matches
  return pageMeta(args, profileHead(user.loaderData.profile, lang.loaderData, 'favorites'))
}

export default function UserFavoritesRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <FavoriteShowcase showcase={loaderData} own={site.loaderData.viewer?.id === loaderData.owner} />
  )
}
