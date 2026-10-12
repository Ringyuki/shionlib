import { Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { protocolName } from '~/features/admin-ai'
import type { Adjustment, Route } from '../admin-ai-route'

export function useAdjustmentText() {
  const t = useTranslations('adminAiRoute.adjusted')
  return (adjustment: Adjustment) =>
    adjustment.kind === 'protocol'
      ? t('protocol', { protocol: protocolName(adjustment.value) })
      : t(adjustment.kind, { name: adjustment.value })
}

export function RouteAdjustments({ route }: { route: Route }) {
  const text = useAdjustmentText()
  const adjustments = route.adjustments ?? []
  return adjustments.length === 0 ? null : (
    <Stack gap="none">
      {adjustments.map(adjustment => (
        <Text key={adjustment.id} as="span" size="sm" tone="warning">
          {text(adjustment)}
        </Text>
      ))}
    </Stack>
  )
}
