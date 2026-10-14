import { FriendsPage } from '~/features/friends'
import type { Route } from './+types/friend-link'

export { friendsLoader as loader } from '~/features/friends/friends.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.friends.title} | Shionlib` }]
}

export default function FriendLinkRoute({ loaderData }: Route.ComponentProps) {
  return <FriendsPage friends={loaderData.friends} />
}
