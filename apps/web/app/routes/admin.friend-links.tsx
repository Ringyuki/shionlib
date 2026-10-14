import { FriendLinksPage } from '~/features/admin-friend-link'
import type { Route } from './+types/admin.friend-links'
import { pageMeta } from '~/shared/seo/seo'

export { friendLinksLoader as loader } from '~/features/admin-friend-link/admin-friend-link.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, {
    title: admin.loaderData.messages.adminFriendLink.title,
    indexable: false,
  })
}

export default function AdminFriendLinks({ loaderData }: Route.ComponentProps) {
  return <FriendLinksPage {...loaderData} />
}
