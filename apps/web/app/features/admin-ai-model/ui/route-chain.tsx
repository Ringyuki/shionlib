import { Indicator, Inline, Text } from '@hina-ui/react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Model } from '../admin-ai-model'

const tones = { active: 'success', suspended: 'danger', disabled: 'neutral' } as const

export function RouteChain({ model }: { model: Model }) {
  const t = useTranslations('adminAiModel')
  const routes = model.routes ?? []
  if (routes.length === 0) {
    return (
      <Text as="span" size="sm" tone="faint">
        {t('noRoutes')}
      </Text>
    )
  }
  return (
    <Inline gap="sm" align="center" wrap={false}>
      {routes.map((route, index) => (
        <Inline key={route.id} gap="xs" align="center" wrap={false}>
          {index > 0 && <ArrowRight aria-hidden className="text-faint me-1 size-3" />}
          <Indicator
            tone={tones[route.status]}
            size="sm"
            label={t(`routeStatus.${route.status}`)}
          />
          <Text as="span" size="sm">
            {route.provider.name}
          </Text>
        </Inline>
      ))}
    </Inline>
  )
}
