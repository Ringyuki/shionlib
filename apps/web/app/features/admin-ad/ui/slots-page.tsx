import { Card, Tag, Text } from '@hina-ui/react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, type RecordColumn } from '~/features/admin'
import type { SlotSummary } from '../admin-ad'
import { AdDialog, type Editing } from './ad-dialog'
import { AdsFrame } from './ads-frame'

export function SlotsPage({ slots }: { slots: SlotSummary[] }) {
  const t = useTranslations('adminAd')
  const format = useFormatter()
  const [editing, setEditing] = useState<Editing>()
  const columns: RecordColumn[] = [
    { key: 'slot', label: t('slots.slot'), className: 'min-w-24' },
    { key: 'place', label: t('slots.place'), wide: true },
    { key: 'material', label: t('slots.material'), wide: true },
    { key: 'shown', label: t('slots.shown'), wide: true },
    { key: 'running', label: t('slots.running'), fill: true },
    { key: 'views', label: t('slots.views'), wide: true, align: 'end' },
    { key: 'clicks', label: t('slots.clicks'), wide: true, align: 'end' },
  ]
  const shownOf = (slot: SlotSummary) =>
    slot.material === 'side'
      ? t('shown.side', { count: slot.shown })
      : t(slot.shown > 1 ? 'shown.wide' : 'shown.single', { count: slot.shown })
  const running = (slot: SlotSummary) => slot.running ?? []
  return (
    <AdsFrame tab="slots" onCreate={() => setEditing({ ad: undefined })}>
      <Card padded={false}>
        <RecordTable
          label={t('tabs.slots')}
          rows={slots}
          rowKey={slot => slot.slot}
          columns={columns}
          empty={t('slots.none')}
          footer={
            <Text as="span" size="sm" tone="muted">
              {t('slots.total', { count: slots.length })}
            </Text>
          }
          renderCell={(slot, column) => {
            switch (column) {
              case 'slot':
                return (
                  <Text as="span" size="sm" weight="medium">
                    {t(`slot.${slot.slot}`)}
                  </Text>
                )
              case 'place':
                return (
                  <Text as="span" size="sm" tone="muted">
                    {t(`place.${slot.slot}`)}
                  </Text>
                )
              case 'material':
                return <Tag>{t(`material.${slot.material}`)}</Tag>
              case 'shown':
                return (
                  <Text as="span" size="sm">
                    {shownOf(slot)}
                  </Text>
                )
              case 'running':
                return (
                  <Text as="span" size="sm" tone={running(slot).length === 0 ? 'muted' : undefined}>
                    {running(slot).length === 0
                      ? t('slots.none')
                      : running(slot)
                          .map(ad => ad.name)
                          .join('、')}
                  </Text>
                )
              default:
                return (
                  <Text as="span" size="sm" className="tabular-nums">
                    {format.number(column === 'views' ? slot.week.views : slot.week.clicks)}
                  </Text>
                )
            }
          }}
        />
      </Card>
      <AdDialog editing={editing} onClose={() => setEditing(undefined)} />
    </AdsFrame>
  )
}
