import { Link } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { adminPaths, StatFigures } from '~/features/admin'
import { rateOf, type Overview } from '../admin-ad'
import { usePercent } from '../use-percent'

export function AdFigures({ overview }: { overview: Overview }) {
  const t = useTranslations('adminAd.figure')
  const format = useFormatter()
  const percent = usePercent()
  const rate = rateOf(overview.week)
  const state = overview.enabled ? 'on' : 'off'
  return (
    <StatFigures
      figures={[
        { label: t('running'), value: format.number(overview.running) },
        { label: t('views'), value: format.number(overview.week.views) },
        {
          label: t('clicks'),
          value: format.number(overview.week.clicks),
          note: rate === undefined ? undefined : t('rate', { rate: percent(rate) }),
        },
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
