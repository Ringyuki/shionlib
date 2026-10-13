import { Flex, Grid, Spinner, Text } from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useHydrated } from '~/shared/ui/use-hydrated'
import { useNarrow } from '~/shared/ui/use-media'
import { payable, watchEvery } from '../sponsor'
import type { OrderPage } from '../sponsor.use-cases'
import { useOrderRows } from '../use-order-rows'
import { useOrderWatch } from '../use-order-watch'
import { usePayment } from '../use-payment'
import { useAmount } from '../use-sponsor-format'
import { BottomBar } from './bottom-bar'
import { MethodList } from './method-list'
import { OrderSummary } from './order-summary'
import { PayPanel } from './pay-panel'

type PaymentStepProps = {
  page: OrderPage
  now: string
}

export function PaymentStep({ page, now }: PaymentStepProps) {
  const t = useTranslations('sponsor')
  const money = useAmount()
  const rowsOf = useOrderRows()
  const hydrated = useHydrated()
  const narrow = useNarrow()
  const { order } = page.view
  const methods = payable(page.view.payment_methods)
  const payment = usePayment(order)
  const [picked, setPicked] = useState<string>()
  const method = methods.find(offered => offered.method === picked) ?? methods[0]
  const { started } = payment
  useOrderWatch(started === undefined ? undefined : watchEvery)
  const total = money(order.amount)
  const go = (block: boolean) => (
    <Button
      size="lg"
      block={block}
      disabled={method === undefined}
      loading={payment.pending}
      onClick={() => method !== undefined && void payment.start(method.method, narrow)}
      className="min-w-36"
    >
      <Text as="span" size="inherit" className="max-sm:hidden">
        {t('checkout.continue')}
      </Text>
      <Text as="span" size="inherit" className="inline-flex items-center gap-2 sm:hidden">
        {t('pay.go')}
        <ExternalLink aria-hidden className="size-4" />
      </Text>
    </Button>
  )
  return (
    <>
      <Grid className="items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        {!hydrated ? (
          <Flex align="center" justify="center" className="min-h-60">
            <Spinner />
          </Flex>
        ) : started === undefined ? (
          <MethodList methods={methods} value={method?.method} onValueChange={setPicked} />
        ) : (
          <PayPanel
            started={started}
            due={order.amount}
            given={methods.find(offered => offered.method === started.method)?.name}
            onChange={payment.change}
          />
        )}
        <OrderSummary
          rows={rowsOf(page.view, new Date(now))}
          total={total}
          action={started === undefined ? go(true) : undefined}
        />
      </Grid>
      {started === undefined && <BottomBar total={total}>{go(false)}</BottomBar>}
    </>
  )
}
