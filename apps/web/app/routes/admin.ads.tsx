import { AdsPage } from '~/features/admin-ad'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/admin.ads'

export { adsLoader as loader } from '~/features/admin-ad/admin-ad.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminAd.title, indexable: false })
}

export default function AdminAds({ loaderData }: Route.ComponentProps) {
  return <AdsPage {...loaderData} />
}
