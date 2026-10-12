import { ChecksPage } from '~/features/admin-check'
import type { Route } from './+types/admin.checks'

export { checksLoader as loader } from '~/features/admin-check/admin-check.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminCheck.title} | Shionlib` }]
}

export default function AdminChecks({ loaderData }: Route.ComponentProps) {
  return <ChecksPage {...loaderData} />
}
