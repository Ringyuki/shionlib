import { ReportsPage } from '~/features/admin-report'
import type { Route } from './+types/admin.reports'
import { pageMeta } from '~/shared/seo/seo'

export { reportsLoader as loader } from '~/features/admin-report/admin-report.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminReport.title, indexable: false })
}

export default function AdminReports({ loaderData }: Route.ComponentProps) {
  return <ReportsPage {...loaderData} />
}
