import { CheckoutPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor.new'

export { checkoutLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.sponsor.checkout.title} | Shionlib` }]
}

export default function SponsorCheckoutRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <CheckoutPage state={loaderData.state} viewer={site.loaderData.viewer} now={loaderData.now} />
  )
}
