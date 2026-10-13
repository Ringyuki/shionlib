import { UsersPage } from '~/features/admin-user'
import type { Route } from './+types/admin.users'

export { usersLoader as loader } from '~/features/admin-user/admin-user.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminUser.title} | Shionlib` }]
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  return <UsersPage {...loaderData} />
}
