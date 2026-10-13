import { OverviewPage } from '~/features/admin'
import type { Route } from './+types/admin.overview'

export { overviewLoader as loader } from '~/features/admin/admin.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.admin.overview.title} | Shionlib` }]
}

export default function AdminOverviewRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , , , admin] = matches
  return <OverviewPage pending={admin.loaderData.pending} {...loaderData} />
}
