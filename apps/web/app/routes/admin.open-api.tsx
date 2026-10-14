import { OpenPage } from '~/features/admin-open'
import type { Route } from './+types/admin.open-api'

export { openLoader as loader } from '~/features/admin-open/admin-open.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminOpen.title} | Shionlib` }]
}

export default function AdminOpenApi({ loaderData }: Route.ComponentProps) {
  return <OpenPage {...loaderData} />
}
