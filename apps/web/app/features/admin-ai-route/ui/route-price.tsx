import { useTranslations } from 'use-intl'
import { TwoLines } from '~/features/admin'
import { usePriceText } from '~/features/admin-ai'
import type { Route } from '../admin-ai-route'

export function RoutePrice({ route }: { route: Route }) {
  const t = useTranslations('adminAiRoute.price')
  const price = usePriceText()
  return (
    <TwoLines
      first={price(route.input_price, route.output_price)}
      second={t(route.price_manual ? 'manual' : 'catalog')}
    />
  )
}
