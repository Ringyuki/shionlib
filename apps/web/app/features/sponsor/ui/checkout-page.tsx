import { Divider, Form, Grid, Stack } from '@hina-ui/react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import {
  badgeDays,
  badgeUntil,
  defaultAmount,
  previewOf,
  type Self,
  type SponsorState,
} from '../sponsor'
import { orderForm, type OrderValues } from '../sponsor.schema'
import { useOrderCreation } from '../use-order-creation'
import { useBadgeRow } from '../use-order-rows'
import { useOrderWatch } from '../use-order-watch'
import { useAmount } from '../use-sponsor-format'
import { AmountField } from './amount-field'
import { BottomBar } from './bottom-bar'
import { CheckoutFrame } from './checkout-frame'
import { ContentFields } from './content-fields'
import { GuestNotice } from './guest-notice'
import { OrderSummary } from './order-summary'
import { WallPreview } from './wall-preview'

type CheckoutPageProps = {
  state: SponsorState
  viewer: Self | null
  now: string
}

const blank: OrderValues = { amount: defaultAmount, name: '', message: '', shown: true }

const missing = '—'

export function CheckoutPage({ state, viewer, now }: CheckoutPageProps) {
  const t = useTranslations('sponsor')
  const issue = useTranslations('sponsor.issue')
  const locale = useLocale()
  const money = useAmount()
  const badgeRow = useBadgeRow()
  const kit = useFormKit()
  const [values, setValues] = useState(blank)
  const creation = useOrderCreation(locale, viewer === null)
  const form = useFormErrors(creation.failure)
  useOrderWatch(undefined)
  const { amount } = values
  const until =
    viewer === null || amount === null
      ? undefined
      : badgeUntil(
          new Date(now),
          viewer.sponsor_expires_at,
          badgeDays(amount, state.badge_days_per_dollar),
        )
  const total = amount === null ? missing : money(amount)
  const submit = (block: boolean) => (
    <Button
      size="lg"
      block={block}
      loading={creation.pending}
      onClick={() => void form.current?.submit()}
      className="min-w-36"
    >
      {t('checkout.continue')}
    </Button>
  )
  return (
    <CheckoutFrame step={1}>
      <Grid className="items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <Form
          ref={form}
          values={values}
          rules={orderForm(kit, issue)}
          onSubmit={async () => {
            if (amount !== null) {
              await creation.run({ ...values, amount })
            }
          }}
        >
          <Stack gap="lg">
            {viewer === null && <GuestNotice />}
            <AmountField
              amount={amount}
              perDollar={viewer === null ? undefined : state.badge_days_per_dollar}
              onAmountChange={next => setValues({ ...values, amount: next })}
            />
            <Divider />
            <ContentFields values={values} onValuesChange={setValues} named={viewer === null} />
            <Divider />
            <WallPreview
              shown={values.shown}
              onShownChange={shown => setValues({ ...values, shown })}
              card={previewOf(viewer, values)}
              profile={viewer === null ? undefined : profilePath(locale, viewer.id)}
            />
          </Stack>
        </Form>
        <OrderSummary
          rows={badgeRow(until)}
          total={total}
          action={submit(true)}
          className="max-lg:hidden"
        />
      </Grid>
      <BottomBar total={total}>{submit(false)}</BottomBar>
    </CheckoutFrame>
  )
}
