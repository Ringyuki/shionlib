import { FriendLinksPage } from '~/features/admin-friend-link'
import type { Route } from './+types/admin.friend-links'

export { friendLinksLoader as loader } from '~/features/admin-friend-link/admin-friend-link.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminFriendLink.title} | Shionlib` }]
}

export default function AdminFriendLinks({ loaderData }: Route.ComponentProps) {
  return <FriendLinksPage {...loaderData} />
}
