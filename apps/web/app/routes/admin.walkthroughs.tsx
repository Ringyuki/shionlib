import { WalkthroughsPage } from '~/features/admin-walkthrough'
import type { Route } from './+types/admin.walkthroughs'
import { pageMeta } from '~/shared/seo/seo'

export { walkthroughsLoader as loader } from '~/features/admin-walkthrough/admin-walkthrough.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, {
    title: admin.loaderData.messages.adminWalkthrough.title,
    indexable: false,
  })
}

export default function AdminWalkthroughs({ loaderData }: Route.ComponentProps) {
  return <WalkthroughsPage {...loaderData} />
}
