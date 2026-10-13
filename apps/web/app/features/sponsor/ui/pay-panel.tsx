import { Card, Inline, QRCode, Spinner, Stack, Text } from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { Started } from '../sponsor'
import { useAmount, useMethodName, usePaidAmount } from '../use-sponsor-format'
import { MethodMark } from './method-mark'

type PayPanelProps = {
  started: Started
  due: number
  given: string | undefined
  onChange: () => void
}

export function PayPanel({ started, due, given, onChange }: PayPanelProps) {
  const t = useTranslations('sponsor.pay')
  const nameOf = useMethodName()
  const money = useAmount()
  const paid = usePaidAmount()
  const { amount, payCurrency, payUrl, method } = started
  return (
    <Card>
      <Stack gap="lg" align="center" className="py-4 sm:py-6">
        <Inline gap="sm" align="center" wrap={false}>
          <MethodMark method={method} />
          <Text weight="semibold">{nameOf(method, given)}</Text>
        </Inline>
        <Stack gap="none" align="center">
          <Text size="xs" tone="muted">
            {t('amount')}
          </Text>
          <Text weight="semibold" className="text-4xl tabular-nums">
            {amount !== null && amount > 0 && payCurrency !== null
              ? paid(amount, payCurrency)
              : money(due)}
          </Text>
        </Stack>
        <QRCode
          value={payUrl}
          label={t('code')}
          size={216}
          bordered={false}
          className="max-sm:hidden"
        />
        <Inline role="status" gap="sm" align="center" wrap={false}>
          <Spinner size="sm" />
          <Text size="sm" tone="muted">
            {t('waiting')}
          </Text>
        </Inline>
        <Inline gap="sm" align="center" justify="center" className="max-sm:w-full max-sm:flex-col">
          <Button
            as="a"
            href={payUrl}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            tone="neutral"
            icon={<ExternalLink />}
            className="max-sm:w-full"
          >
            <Text as="span" size="inherit" className="sm:hidden">
              {t('reopen')}
            </Text>
            <Text as="span" size="inherit" className="max-sm:hidden">
              {t('open')}
            </Text>
          </Button>
          <Button variant="ghost" tone="neutral" onClick={onChange} className="max-sm:w-full">
            {t('change')}
          </Button>
        </Inline>
      </Stack>
    </Card>
  )
}
