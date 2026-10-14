import { OverviewPage } from '~/features/admin'
import type { Route } from './+types/admin.overview'
import { pageMeta } from '~/shared/seo/seo'

export { overviewLoader as loader } from '~/features/admin/admin.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.admin.overview.title, indexable: false })
}

export default function AdminOverviewRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , , , admin] = matches
  return <OverviewPage pending={admin.loaderData.pending} {...loaderData} />
}
