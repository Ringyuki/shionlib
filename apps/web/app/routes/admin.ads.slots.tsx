import { SlotsPage } from '~/features/admin-ad'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/admin.ads.slots'

export { adSlotsLoader as loader } from '~/features/admin-ad/admin-ad.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminAd.tabs.slots, indexable: false })
}

export default function AdminAdSlots({ loaderData }: Route.ComponentProps) {
  return <SlotsPage {...loaderData} />
}
