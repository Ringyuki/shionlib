import { Card, Inline, PageHeader, SegmentedControl, Stack, Text, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { pageSize } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { ranges, searchOf, type Filter } from '../admin-open'
import type { Listing } from '../admin-open.use-cases'
import { useOpenChange } from '../use-open-change'
import { KeyFilters } from './key-filters'
import { KeyPane } from './key-pane'
import { KeyTable } from './key-table'
import { LimitDialog, type Limiting } from './limit-dialog'
import { OpenFigures } from './open-figures'
import { SuspendDialog, type Suspending } from './suspend-dialog'
import { UsageChart } from './usage-chart'

export function OpenPage({ filter, summary, days, keys, total, detail }: Listing) {
  const t = useTranslations('adminOpen')
  const stay = useInPageNavigate()
  const change = useOpenChange()
  const [suspending, setSuspending] = useState<Suspending>()
  const [limiting, setLimiting] = useState<Limiting>()
  const show = (changes: Partial<Filter>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const restore = async (id: number) => {
    const outcome = await change.run({ action: 'restore', id })
    if (outcome.ok) {
      toast.success(t('restored'))
    }
  }
  const submitted = change.pending ? change.submitted : undefined
  const pending = submitted !== undefined && 'id' in submitted ? submitted.id : undefined
  const filtered = filter.status !== undefined || filter.query !== '' || filter.user !== undefined
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <OpenFigures summary={summary} />
      <Card>
        <Stack gap="md">
          <Inline gap="md" align="center" className="justify-between">
            <Text as="h2" size="md" weight="semibold">
              {t('chart.title')}
            </Text>
            <SegmentedControl
              size="sm"
              aria-label={t('chart.range')}
              value={filter.days}
              options={ranges.map(range => ({
                value: range,
                label: t('chart.days', { days: range }),
              }))}
              onValueChange={value => show({ days: ranges.find(range => range === value) })}
            />
          </Inline>
          <UsageChart days={days} label={t('chart.title')} />
        </Stack>
      </Card>
      <Card padded={false}>
        <KeyFilters filter={filter} onChange={show} />
        <KeyTable
          keys={keys}
          paging={{ page: filter.page, pageSize, total }}
          filtered={filtered}
          current={filter.key}
          pending={pending}
          onOpen={item => show({ key: item.id })}
          onSuspend={item =>
            setSuspending({ id: item.id, name: item.name, owner: item.owner.name })
          }
          onRestore={item => void restore(item.id)}
        />
      </Card>
      <KeyPane
        detail={detail}
        pending={pending === detail?.key.id}
        onClose={() => show({ key: undefined })}
        onSuspend={opened =>
          setSuspending({ id: opened.key.id, name: opened.key.name, owner: opened.key.owner.name })
        }
        onRestore={opened => void restore(opened.key.id)}
        onLimit={opened =>
          setLimiting({
            userId: opened.key.owner.id,
            owner: opened.key.owner.name,
            limit: opened.account_limit,
          })
        }
      />
      <SuspendDialog suspending={suspending} onClose={() => setSuspending(undefined)} />
      <LimitDialog limiting={limiting} onClose={() => setLimiting(undefined)} />
    </Stack>
  )
}
