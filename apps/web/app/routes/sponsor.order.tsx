import { OrderPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor.order'
import { pageMeta } from '~/shared/seo/seo'

export { orderLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, {
    title: lang.loaderData.messages.sponsor.checkout.title,
    indexable: false,
  })
}

export default function SponsorOrderRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <OrderPage page={loaderData.page} viewer={site.loaderData.viewer} now={loaderData.now} />
}
