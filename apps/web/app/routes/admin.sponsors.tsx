import { SponsorsPage } from '~/features/admin-sponsor'
import type { Route } from './+types/admin.sponsors'
import { pageMeta } from '~/shared/seo/seo'

export { sponsorsLoader as loader } from '~/features/admin-sponsor/admin-sponsor.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminSponsor.title, indexable: false })
}

export default function AdminSponsors({ loaderData }: Route.ComponentProps) {
  return <SponsorsPage {...loaderData} />
}
