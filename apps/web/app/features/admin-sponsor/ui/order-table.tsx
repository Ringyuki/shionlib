import { Avatar, Inline, Tag, Text, Time, useImageResolver } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import { sponsorOf, statusTones, type Order, type Settable } from '../admin-sponsor'
import { useAmount, useMethodName } from '~/features/sponsor'
import { OrderMenu } from './order-menu'

type OrderTableProps = {
  orders: Order[]
  paging: Paging
  filtered: boolean
  busy: number | undefined
  onMark: (order: Order, status: Settable) => void
  onRemove: (order: Order) => void
}

const missing = '—'

function Sponsor({ order }: { order: Order }) {
  const t = useTranslations('adminSponsor')
  const amount = useAmount()
  const resolveImage = useImageResolver()
  const sponsor = sponsorOf(order)
  const paid = order.paidAt
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Avatar
        name={sponsor.name}
        src={sponsor.avatar === null ? undefined : resolveImage(sponsor.avatar, 'image')}
        className="shrink-0"
      />
      <TwoLines
        first={sponsor.name ?? t('anonymous')}
        second={t(order.isPrivate ? 'private' : 'order', { number: order.providerOrderId })}
        narrow={
          paid === null
            ? t('narrowUnpaid', { amount: amount(order.amount) })
            : t.rich('narrow', {
                amount: amount(order.amount),
                time: () => <Time value={paid} format="relative" tooltip={false} />,
              })
        }
      />
    </Inline>
  )
}

export function OrderTable({ orders, paging, filtered, busy, onMark, onRemove }: OrderTableProps) {
  const t = useTranslations('adminSponsor')
  const shared = useTranslations('admin')
  const amount = useAmount()
  const methodName = useMethodName()
  const columns: RecordColumn[] = [
    { key: 'sponsor', label: t('column.sponsor'), fill: true },
    { key: 'amount', label: t('column.amount'), wide: true, align: 'end', className: 'min-w-24' },
    { key: 'method', label: t('column.method'), wide: true, className: 'min-w-28' },
    { key: 'message', label: t('column.message'), wide: true, className: 'w-[28%] min-w-56' },
    { key: 'paid', label: t('column.paid'), wide: true, className: 'min-w-32 whitespace-nowrap' },
    { key: 'status', label: t('column.status'), className: 'min-w-20' },
    { key: 'menu', label: '' },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={orders}
      rowKey={order => order.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(order, column) => {
        switch (column) {
          case 'sponsor':
            return <Sponsor order={order} />
          case 'amount':
            return (
              <Text as="span" size="sm" className="tabular-nums">
                {amount(order.amount)}
              </Text>
            )
          case 'method':
            return order.paymentMethod === null ? missing : methodName(order.paymentMethod)
          case 'message':
            return order.message === null || order.message === '' ? (
              missing
            ) : (
              <Text as="span" size="sm" className="line-clamp-2">
                {order.message}
              </Text>
            )
          case 'paid':
            return order.paidAt === null ? (
              missing
            ) : (
              <Time value={order.paidAt} format="relative" className="text-muted text-sm" />
            )
          case 'status':
            return <Tag tone={statusTones[order.status]}>{t(`status.${order.status}`)}</Tag>
          default:
            return (
              <OrderMenu
                order={order}
                busy={busy === order.id}
                onMark={onMark}
                onRemove={onRemove}
              />
            )
        }
      }}
    />
  )
}
