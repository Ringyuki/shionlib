import { AlertDialog, Card, Stack, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { pageSize } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { useLast } from '~/shared/ui/use-last'
import { searchOf, type AdminAd, type Filter } from '../admin-ad'
import type { Listing } from '../admin-ad.use-cases'
import { useAdChange } from '../use-ad-change'
import { AdDialog, type Editing } from './ad-dialog'
import { AdFigures } from './ad-figures'
import { AdFilters } from './ad-filters'
import { AdPane } from './ad-pane'
import { AdTable } from './ad-table'
import { AdsFrame } from './ads-frame'

export function AdsPage({ filter, overview, ads, total, opened }: Listing) {
  const t = useTranslations('adminAd')
  const shared = useTranslations('admin')
  const stay = useInPageNavigate()
  const change = useAdChange()
  const [editing, setEditing] = useState<Editing>()
  const [removing, setRemoving] = useState<AdminAd>()
  const removed = useLast(removing)
  const show = (changes: Partial<Filter>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const submitted = change.pending ? change.submitted : undefined
  const pending = submitted !== undefined && 'id' in submitted ? submitted.id : undefined
  const toggle = async (ad: AdminAd) => {
    const outcome = await change.run({ action: 'enabled', id: ad.id, enabled: !ad.enabled })
    if (outcome.ok) {
      toast.success(t('toggled', { enabled: String(!ad.enabled) }))
    }
  }
  const actions = {
    onEdit: (ad: AdminAd) => setEditing({ ad }),
    onToggle: (ad: AdminAd) => void toggle(ad),
    onRemove: setRemoving,
  }
  return (
    <AdsFrame tab="ads" onCreate={() => setEditing({ ad: undefined })}>
      <Stack gap="lg">
        <AdFigures overview={overview} />
        <Card padded={false}>
          <AdFilters filter={filter} onChange={show} />
          <AdTable
            ads={ads}
            paging={{ page: filter.page, pageSize, total }}
            filtered={filter.status !== undefined || filter.slot !== undefined}
            current={filter.ad}
            pending={pending}
            onOpen={ad => show({ ad: ad.id })}
            {...actions}
          />
        </Card>
      </Stack>
      <AdPane
        opened={opened}
        days={filter.days}
        pending={opened !== undefined && pending === opened.ad.id}
        onClose={() => show({ ad: undefined })}
        onDays={days => show({ days }, true)}
        {...actions}
      />
      <AdDialog editing={editing} onClose={() => setEditing(undefined)} />
      <AlertDialog
        tone="danger"
        title={t('remove.title', { name: removed?.name ?? '' })}
        description={t('remove.description')}
        confirmText={t('remove.confirm')}
        cancelText={shared('cancel')}
        open={removing !== undefined}
        onOpenChange={open => {
          if (!open) {
            setRemoving(undefined)
          }
        }}
        onConfirm={async () => {
          if (removing !== undefined) {
            await change.confirm({ action: 'remove', id: removing.id })
            toast.success(t('remove.done'))
            if (filter.ad === removing.id) {
              show({ ad: undefined }, true)
            }
          }
        }}
      />
    </AdsFrame>
  )
}
