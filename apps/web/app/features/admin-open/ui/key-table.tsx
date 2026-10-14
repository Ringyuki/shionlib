import { Inline, Tag, Text, Time } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, TwoLines, UserRef, type Paging, type RecordColumn } from '~/features/admin'
import { busy, type AdminKey } from '../admin-open'
import { KeyMenu } from './key-menu'

type KeyTableProps = {
  keys: AdminKey[]
  paging: Paging
  filtered: boolean
  current: number | undefined
  pending: number | undefined
  onOpen: (item: AdminKey) => void
  onSuspend: (item: AdminKey) => void
  onRestore: (item: AdminKey) => void
}

export function KeyTable({
  keys,
  paging,
  filtered,
  current,
  pending,
  onOpen,
  onSuspend,
  onRestore,
}: KeyTableProps) {
  const t = useTranslations('adminOpen')
  const shared = useTranslations('admin')
  const format = useFormatter()
  const columns: RecordColumn[] = [
    { key: 'key', label: t('column.key'), fill: true },
    { key: 'owner', label: t('column.owner'), wide: true, className: 'min-w-32' },
    { key: 'requests', label: t('column.requests'), wide: true, align: 'end' },
    { key: 'throttled', label: t('column.throttled'), wide: true, align: 'end' },
    { key: 'used', label: t('column.used'), wide: true, className: 'min-w-24 whitespace-nowrap' },
    {
      key: 'created',
      label: t('column.created'),
      wide: true,
      className: 'min-w-28 whitespace-nowrap',
    },
    { key: 'status', label: t('column.status'), className: 'min-w-16' },
    { key: 'menu', label: '' },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={keys}
      rowKey={item => item.id}
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
      renderCell={(item, column) => {
        switch (column) {
          case 'key':
            return (
              <TwoLines
                first={item.name}
                second={`${item.prefix}…`}
                narrow={t('narrow', { requests: item.recent.requests })}
                mono
              />
            )
          case 'owner':
            return <UserRef user={item.owner} />
          case 'requests':
            return (
              <Text as="span" size="sm" className="tabular-nums">
                {format.number(item.recent.requests)}
              </Text>
            )
          case 'throttled':
            return (
              <Text
                as="span"
                size="sm"
                tone={busy(item) ? 'warning' : undefined}
                className="tabular-nums"
              >
                {format.number(item.recent.throttled)}
              </Text>
            )
          case 'used':
            return item.last_used_at === null ? (
              <Text as="span" size="sm" tone="faint">
                {t('neverUsed')}
              </Text>
            ) : (
              <Time value={item.last_used_at} format="relative" className="text-muted text-sm" />
            )
          case 'created':
            return (
              <Text as="span" size="sm" tone="muted">
                {format.dateTime(new Date(item.created), { dateStyle: 'medium' })}
              </Text>
            )
          case 'status':
            return (
              <Tag tone={item.status === 'active' ? 'success' : 'warning'}>
                {t(`status.${item.status}`)}
              </Tag>
            )
          default:
            return (
              <Inline justify="end">
                <KeyMenu
                  item={item}
                  busy={pending === item.id}
                  onSuspend={onSuspend}
                  onRestore={onRestore}
                />
              </Inline>
            )
        }
      }}
    />
  )
}
