import { UserPage } from '~/features/admin-user'
import type { Route } from './+types/admin.user'
import { pageMeta } from '~/shared/seo/seo'

export { userLoader as loader } from '~/features/admin-user/admin-user.server'

export function meta(args: Route.MetaArgs) {
  return pageMeta(
    args,
    args.loaderData === undefined
      ? undefined
      : { title: args.loaderData.detail.name, indexable: false },
  )
}

export default function AdminUser({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <UserPage opened={loaderData} viewer={site.loaderData.viewer} />
}
