import { OpenPage } from '~/features/admin-open'
import type { Route } from './+types/admin.open-api'
import { pageMeta } from '~/shared/seo/seo'

export { openLoader as loader } from '~/features/admin-open/admin-open.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminOpen.title, indexable: false })
}

export default function AdminOpenApi({ loaderData }: Route.ComponentProps) {
  return <OpenPage {...loaderData} />
}
