import { Link } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { adminPaths, StatFigures } from '~/features/admin'
import type { Summary } from '../admin-open'

export function OpenFigures({ summary }: { summary: Summary }) {
  const t = useTranslations('adminOpen.figure')
  const format = useFormatter()
  const state = summary.enabled ? 'open' : 'closed'
  return (
    <StatFigures
      figures={[
        { label: t('today'), value: format.number(summary.today) },
        { label: t('throttled'), value: format.number(summary.throttled) },
        { label: t('used'), value: t('usedValue', { used: summary.used, total: summary.total }) },
        {
          label: t('state'),
          value: t(state),
          note: t.rich(`${state}Next`, {
            settings: chunks => (
              <Link asChild>
                <RouterLink to={adminPaths.settings}>{chunks}</RouterLink>
              </Link>
            ),
          }),
        },
      ]}
    />
  )
}
