import { Link } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { adminPaths, StatFigures } from '~/features/admin'
import { acceptance, type Stats } from '../admin-sponsor'
import { useAmount } from '~/features/sponsor'

export function SponsorFigures({ stats }: { stats: Stats }) {
  const t = useTranslations('adminSponsor.figure')
  const format = useFormatter()
  const amount = useAmount()
  const state = acceptance(stats)
  return (
    <StatFigures
      figures={[
        { label: t('total'), value: amount(stats.totalAmount) },
        { label: t('orders'), value: format.number(stats.totalSponsors) },
        { label: t('month'), value: amount(stats.monthAmount) },
        {
          label: t('module'),
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
