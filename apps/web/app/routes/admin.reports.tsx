import { ReportsPage } from '~/features/admin-report'
import type { Route } from './+types/admin.reports'

export { reportsLoader as loader } from '~/features/admin-report/admin-report.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminReport.title} | Shionlib` }]
}

export default function AdminReports({ loaderData }: Route.ComponentProps) {
  return <ReportsPage {...loaderData} />
}
