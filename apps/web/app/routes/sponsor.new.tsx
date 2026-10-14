import { CheckoutPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor.new'
import { pageMeta } from '~/shared/seo/seo'

export { checkoutLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, {
    title: lang.loaderData.messages.sponsor.checkout.title,
    indexable: false,
  })
}

export default function SponsorCheckoutRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <CheckoutPage state={loaderData.state} viewer={site.loaderData.viewer} now={loaderData.now} />
  )
}
