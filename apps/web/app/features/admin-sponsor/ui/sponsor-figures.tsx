import { Link } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { adminPaths, StatFigures } from '~/features/admin'
import type { Stats } from '../admin-sponsor'
import { useAmount } from '../use-sponsor-format'

export function SponsorFigures({ stats }: { stats: Stats }) {
  const t = useTranslations('adminSponsor.figure')
  const format = useFormatter()
  const amount = useAmount()
  return (
    <StatFigures
      figures={[
        { label: t('total'), value: amount(stats.totalAmount) },
        { label: t('orders'), value: format.number(stats.totalSponsors) },
        { label: t('month'), value: amount(stats.monthAmount) },
        {
          label: t('module'),
          value: t(stats.enabled ? 'open' : 'closed'),
          note: t.rich(stats.enabled ? 'closeIt' : 'openIt', {
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
