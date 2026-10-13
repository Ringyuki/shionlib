import { FormField, Grid, Heading, NumberInput, Stack, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { rangeOf } from '~/shared/form/form-kit'
import { badgeDays, presets } from '../sponsor'
import { ChoiceCard } from './choice-card'

type AmountFieldProps = {
  amount: number | null
  perDollar: number | undefined
  onAmountChange: (amount: number | null) => void
}

const dollars = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const

const whole = { ...dollars, maximumFractionDigits: 0 } as const

const range = rangeOf('CreateSponsorOrderInputBody', 'amount')

export function AmountField({ amount, perDollar, onAmountChange }: AmountFieldProps) {
  const t = useTranslations('sponsor.checkout')
  const format = useFormatter()
  const preset = presets.find(value => value === amount)
  const bounds = [range.min, range.max].flatMap(bound => (bound === undefined ? [] : [bound]))
  return (
    <Stack as="section" gap="md" aria-labelledby="sponsor-amount" className="@container">
      <Heading id="sponsor-amount" level={2} size="md">
        {t('amount')}
      </Heading>
      <Grid
        role="group"
        aria-labelledby="sponsor-amount"
        className="grid-cols-2 gap-3 @xl:grid-cols-4"
      >
        {presets.map(value => (
          <ChoiceCard
            key={value}
            chosen={value === preset}
            onChoose={() => onAmountChange(value)}
            className="px-4 py-3"
          >
            <Stack as="span" gap="none">
              <Text as="span" weight="semibold" className="text-xl tabular-nums">
                {format.number(value, whole)}
              </Text>
              {perDollar !== undefined && (
                <Text as="span" size="xs" tone="muted">
                  {t('badgeDays', { days: badgeDays(value, perDollar) })}
                </Text>
              )}
            </Stack>
          </ChoiceCard>
        ))}
      </Grid>
      <FormField
        name="amount"
        label={t('otherAmount')}
        orientation="horizontal"
        labelWidth="max-content"
      >
        <NumberInput
          {...range}
          controls={false}
          stepSnapping={false}
          formatOptions={dollars}
          value={preset === undefined ? amount : null}
          onValueChange={typed => onAmountChange(typed ?? null)}
          placeholder={bounds.map(bound => format.number(bound, whole)).join(' – ')}
          className="w-50"
        />
      </FormField>
    </Stack>
  )
}
