import { FriendsPage } from '~/features/friends'
import type { Route } from './+types/friend-link'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.friends.title} | Shionlib` }]
}

export default function FriendLinkRoute() {
  return <FriendsPage />
}
