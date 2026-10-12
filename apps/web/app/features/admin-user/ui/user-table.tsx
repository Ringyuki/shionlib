import { Avatar, Inline, Text, Time, useImageResolver } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import type { UserItem } from '../admin-user'
import { RoleLabel, StatusTag } from './user-tags'

type UserTableProps = {
  users: UserItem[]
  paging: Paging
  filtered: boolean
  onOpen: (user: UserItem) => void
}

function Who({ user }: { user: UserItem }) {
  const t = useTranslations('adminUser')
  const resolveImage = useImageResolver()
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Avatar
        name={user.name}
        src={user.avatar === null ? undefined : resolveImage(user.avatar, 'image')}
        className="shrink-0"
      />
      <TwoLines
        first={user.name}
        second={user.email}
        narrow={t.rich('narrow', {
          resources: user.counts.resources,
          comments: user.counts.comments,
          seen: String(user.last_login_at !== null),
          time: () => <Time value={user.last_login_at} format="relative" tooltip={false} />,
        })}
      />
    </Inline>
  )
}

export function UserTable({ users, paging, filtered, onOpen }: UserTableProps) {
  const t = useTranslations('adminUser')
  const shared = useTranslations('admin')
  const number = (value: number) => (
    <Text as="span" size="sm" className="tabular-nums">
      {value}
    </Text>
  )
  const columns: RecordColumn[] = [
    { key: 'user', label: t('column.user'), fill: true },
    { key: 'role', label: t('column.role'), wide: true },
    { key: 'resources', label: t('column.resources'), wide: true, align: 'end' },
    { key: 'comments', label: t('column.comments'), wide: true, align: 'end' },
    { key: 'favorites', label: t('column.favorites'), wide: true, align: 'end' },
    { key: 'seen', label: t('column.seen'), wide: true },
    { key: 'joined', label: t('column.joined'), wide: true },
    { key: 'status', label: t('column.status') },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={users}
      rowKey={user => user.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={onOpen}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(user, column) => {
        switch (column) {
          case 'user':
            return <Who user={user} />
          case 'role':
            return <RoleLabel role={user.role} />
          case 'resources':
            return number(user.counts.resources)
          case 'comments':
            return number(user.counts.comments)
          case 'favorites':
            return number(user.counts.favorites)
          case 'seen':
            return user.last_login_at === null ? (
              <Text as="span" size="sm" tone="muted">
                {t('neverSeen')}
              </Text>
            ) : (
              <Time value={user.last_login_at} format="relative" className="text-muted text-sm" />
            )
          case 'joined':
            return <Time value={user.created} format="date" className="text-muted text-sm" />
          default:
            return <StatusTag status={user.status} />
        }
      }}
    />
  )
}
