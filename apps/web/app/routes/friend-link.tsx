import { FriendsPage } from '~/features/friends'
import type { Route } from './+types/friend-link'
import { pageMeta } from '~/shared/seo/seo'

export { friendsLoader as loader } from '~/features/friends/friends.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.friends.title })
}

export default function FriendLinkRoute({ loaderData }: Route.ComponentProps) {
  return <FriendsPage friends={loaderData.friends} />
}
