import { Inline, Tag, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, type Paging, type RecordColumn } from '~/features/admin'
import { statusTones, type AdminAd } from '../admin-ad'
import { useAdLabels } from '../use-ad-labels'
import { AdIdentity } from './ad-identity'
import { AdMenu, type AdActions } from './ad-menu'

type AdTableProps = AdActions & {
  ads: AdminAd[]
  paging: Paging
  filtered: boolean
  current: number | undefined
  pending: number | undefined
  onOpen: (ad: AdminAd) => void
}

export function AdTable({
  ads,
  paging,
  filtered,
  current,
  pending,
  onOpen,
  ...actions
}: AdTableProps) {
  const t = useTranslations('adminAd')
  const shared = useTranslations('admin')
  const format = useFormatter()
  const labels = useAdLabels()
  const columns: RecordColumn[] = [
    { key: 'ad', label: t('column.ad'), fill: true },
    { key: 'slots', label: t('column.slots'), wide: true },
    { key: 'languages', label: t('column.languages'), wide: true },
    { key: 'schedule', label: t('column.schedule'), wide: true },
    { key: 'status', label: t('column.status') },
    { key: 'views', label: t('column.views'), wide: true, align: 'end' },
    { key: 'clicks', label: t('column.clicks'), wide: true, align: 'end' },
    { key: 'menu', label: '' },
  ]
  const number = (value: number) => (
    <Text as="span" size="sm" className="tabular-nums">
      {format.number(value)}
    </Text>
  )
  return (
    <RecordTable
      label={t('title')}
      rows={ads}
      rowKey={ad => ad.id}
      rowLabel={ad => ad.name}
      columns={columns}
      paging={paging}
      current={current}
      empty={t('empty', { filtered: String(filtered) })}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      onOpen={onOpen}
      renderCell={(ad, column) => {
        switch (column) {
          case 'ad':
            return <AdIdentity ad={ad} />
          case 'slots':
            return (
              <Text as="span" size="sm">
                {labels.slots(ad.slots)}
              </Text>
            )
          case 'languages':
            return (
              <Text as="span" size="sm">
                {labels.languages(ad.languages)}
              </Text>
            )
          case 'schedule':
            return (
              <Text as="span" size="sm" tone="muted">
                {labels.schedule(ad)}
              </Text>
            )
          case 'status':
            return <Tag tone={statusTones[ad.status]}>{t(`status.${ad.status}`)}</Tag>
          case 'views':
            return number(ad.week.views)
          case 'clicks':
            return number(ad.week.clicks)
          default:
            return (
              <Inline justify="end">
                <AdMenu ad={ad} busy={pending === ad.id} {...actions} />
              </Inline>
            )
        }
      }}
    />
  )
}
