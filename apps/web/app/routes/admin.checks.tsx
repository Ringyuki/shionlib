import { ChecksPage } from '~/features/admin-check'
import type { Route } from './+types/admin.checks'
import { pageMeta } from '~/shared/seo/seo'

export { checksLoader as loader } from '~/features/admin-check/admin-check.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminCheck.title, indexable: false })
}

export default function AdminChecks({ loaderData }: Route.ComponentProps) {
  return <ChecksPage {...loaderData} />
}
