import {
  AlertDialog,
  Card,
  Inline,
  PageHeader,
  SegmentedControl,
  Stack,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { pageSize } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { useLast } from '~/shared/ui/use-last'
import {
  grantsBadge,
  searchOf,
  sponsorOf,
  statuses,
  type Order,
  type Settable,
} from '../admin-sponsor'
import type { Listing } from '../admin-sponsor.use-cases'
import { useOrderChange } from '../use-order-change'
import { useAmount } from '~/features/sponsor'
import { OrderTable } from './order-table'
import { SponsorFigures } from './sponsor-figures'

const every = 'all'

type Asked = { order: Order; act: 'complete' | 'remove' }

export function SponsorsPage({ filter, orders, total, stats }: Listing) {
  const t = useTranslations('adminSponsor')
  const shared = useTranslations('admin')
  const stay = useInPageNavigate()
  const change = useOrderChange()
  const amount = useAmount()
  const [asking, setAsking] = useState<Asked>()
  const asked = useLast(asking)
  const number = asked?.order.providerOrderId ?? ''
  const completing = asked?.act === 'complete'
  const mark = async (order: Order, status: Settable) => {
    if (status === 'DONE') {
      setAsking({ order, act: 'complete' })
      return
    }
    const outcome = await change.run({ action: 'status', id: order.id, status })
    if (outcome.ok) {
      toast.success(t(`marked.${status}`))
    }
  }
  const facts = { number, amount: amount(asked?.order.amount ?? 0) }
  const description =
    asked !== undefined && completing
      ? grantsBadge(asked.order)
        ? t('complete.grants', { ...facts, name: sponsorOf(asked.order).name ?? '' })
        : t('complete.plain', facts)
      : t('remove.description', facts)
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <SponsorFigures stats={stats} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SegmentedControl
            size="sm"
            aria-label={t('column.status')}
            value={filter.status ?? every}
            options={[
              { value: every, label: t('everyStatus') },
              ...statuses.map(status => ({ value: status, label: t(`status.${status}`) })),
            ]}
            onValueChange={value =>
              stay({ search: searchOf({ status: statuses.find(status => status === value) }) })
            }
          />
        </Inline>
        <OrderTable
          orders={orders}
          paging={{ page: filter.page, pageSize, total }}
          filtered={filter.status !== undefined}
          busy={change.pending ? change.submitted?.id : undefined}
          onMark={(order, status) => void mark(order, status)}
          onRemove={order => setAsking({ order, act: 'remove' })}
        />
      </Card>
      <AlertDialog
        tone={completing ? 'accent' : 'danger'}
        title={t(completing ? 'complete.title' : 'remove.title')}
        description={description}
        confirmText={t(completing ? 'complete.confirm' : 'remove.confirm')}
        cancelText={shared('cancel')}
        open={asking !== undefined}
        onOpenChange={open => {
          if (!open) {
            setAsking(undefined)
          }
        }}
        onConfirm={async () => {
          if (asking === undefined) {
            return
          }
          if (asking.act === 'complete') {
            await change.confirm({ action: 'status', id: asking.order.id, status: 'DONE' })
            toast.success(t('marked.DONE'))
          } else {
            await change.confirm({ action: 'remove', id: asking.order.id })
            toast.success(t('remove.done'))
          }
        }}
      />
    </Stack>
  )
}
