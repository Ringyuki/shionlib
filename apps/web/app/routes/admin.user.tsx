import { UserPage } from '~/features/admin-user'
import type { Route } from './+types/admin.user'

export { userLoader as loader } from '~/features/admin-user/admin-user.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.detail.name} | Shionlib` }]
}

export default function AdminUser({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <UserPage opened={loaderData} viewer={site.loaderData.viewer} />
}
