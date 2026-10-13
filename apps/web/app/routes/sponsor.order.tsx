import { OrderPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor.order'

export { orderLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.sponsor.checkout.title} | Shionlib` }]
}

export default function SponsorOrderRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <OrderPage page={loaderData.page} viewer={site.loaderData.viewer} now={loaderData.now} />
}
