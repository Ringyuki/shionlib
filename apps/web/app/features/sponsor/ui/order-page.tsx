import { stageOf, type Self } from '../sponsor'
import type { OrderPage as OrderPageData } from '../sponsor.use-cases'
import { useCelebration } from '../use-celebration'
import { CheckoutFrame } from './checkout-frame'
import { OrderEnded } from './order-ended'
import { PaymentStep } from './payment-step'
import { Receipt } from './receipt'

type OrderPageProps = {
  page: OrderPageData
  viewer: Self | null
  now: string
}

export function OrderPage({ page, viewer, now }: OrderPageProps) {
  const { order } = page.view
  const stage = stageOf(order)
  useCelebration(order)
  if (stage === 'pay') {
    return (
      <CheckoutFrame step={2}>
        <PaymentStep page={page} now={now} />
      </CheckoutFrame>
    )
  }
  if (stage === 'done') {
    return (
      <CheckoutFrame step={3}>
        <Receipt view={page.view} viewer={viewer} />
      </CheckoutFrame>
    )
  }
  return (
    <CheckoutFrame step={2}>
      <OrderEnded stage={stage} open={page.state.enabled} />
    </CheckoutFrame>
  )
}
