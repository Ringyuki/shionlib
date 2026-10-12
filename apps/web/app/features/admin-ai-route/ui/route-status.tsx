import { Time, Tooltip } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { errorKindOf, StatusLine } from '~/features/admin-ai'
import type { Route } from '../admin-ai-route'

export function useRouteStatusText() {
  const t = useTranslations('adminAiRoute.status')
  const kinds = useTranslations('adminAi.errorKind')
  return (route: Route) =>
    route.status === 'suspended'
      ? t('suspendedFor', { kind: kinds(errorKindOf(route.status_kind ?? '')) })
      : t(route.status)
}

export function RouteStatus({ route }: { route: Route }) {
  const t = useTranslations('adminAiRoute.status')
  const kinds = useTranslations('adminAi.errorKind')
  if (route.status === 'active') {
    return <StatusLine tone="success" label={t('active')} />
  }
  if (route.status === 'disabled') {
    return <StatusLine tone="neutral" label={t('disabled')} />
  }
  return (
    <Tooltip content={route.status_message ?? ''} disabled={(route.status_message ?? '') === ''}>
      <StatusLine
        tone="danger"
        label={t('suspended')}
        alarming
        note={t.rich('since', {
          kind: kinds(errorKindOf(route.status_kind ?? '')),
          time: () => <Time value={route.status_at} format="relative" tooltip={false} />,
        })}
      />
    </Tooltip>
  )
}
