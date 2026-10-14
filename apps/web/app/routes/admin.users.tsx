import { UsersPage } from '~/features/admin-user'
import type { Route } from './+types/admin.users'
import { pageMeta } from '~/shared/seo/seo'

export { usersLoader as loader } from '~/features/admin-user/admin-user.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminUser.title, indexable: false })
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  return <UsersPage {...loaderData} />
}
