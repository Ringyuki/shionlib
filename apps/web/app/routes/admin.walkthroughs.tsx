import { WalkthroughsPage } from '~/features/admin-walkthrough'
import type { Route } from './+types/admin.walkthroughs'

export { walkthroughsLoader as loader } from '~/features/admin-walkthrough/admin-walkthrough.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminWalkthrough.title} | Shionlib` }]
}

export default function AdminWalkthroughs({ loaderData }: Route.ComponentProps) {
  return <WalkthroughsPage {...loaderData} />
}
