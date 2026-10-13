import { SponsorsPage } from '~/features/admin-sponsor'
import type { Route } from './+types/admin.sponsors'

export { sponsorsLoader as loader } from '~/features/admin-sponsor/admin-sponsor.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminSponsor.title} | Shionlib` }]
}

export default function AdminSponsors({ loaderData }: Route.ComponentProps) {
  return <SponsorsPage {...loaderData} />
}
