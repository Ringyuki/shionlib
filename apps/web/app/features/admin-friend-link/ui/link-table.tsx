import { Avatar, Inline, Tag, Text, Time, useImageResolver } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { hostOf } from '~/features/friends'
import type { Link } from '../admin-friend-link'
import { LinkMenu } from './link-menu'

type LinkTableProps = {
  links: Link[]
  busy: number | undefined
  onReorder: ((ids: number[]) => void) | undefined
  onEdit: (link: Link) => void
  onToggle: (link: Link) => void
  onRemove: (link: Link) => void
}

function Site({ link }: { link: Link }) {
  const t = useTranslations('adminFriendLink')
  const resolveImage = useImageResolver()
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Avatar
        name={link.name}
        src={link.logo === null ? undefined : resolveImage(link.logo, 'image')}
        className="shrink-0"
      />
      <TwoLines
        first={link.name}
        second={hostOf(link.url)}
        narrow={link.visible ? undefined : t('status.hidden')}
      />
    </Inline>
  )
}

export function LinkTable({ links, busy, onReorder, onEdit, onToggle, onRemove }: LinkTableProps) {
  const t = useTranslations('adminFriendLink')
  const shared = useTranslations('admin')
  const columns: RecordColumn[] = [
    { key: 'site', label: t('column.site'), className: 'min-w-56' },
    { key: 'description', label: t('column.description'), wide: true, fill: true },
    { key: 'status', label: t('column.status'), wide: true, className: 'min-w-16' },
    {
      key: 'updated',
      label: t('column.updated'),
      wide: true,
      className: 'min-w-28 whitespace-nowrap',
    },
    { key: 'menu', label: '' },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={links}
      rowKey={link => link.id}
      rowLabel={link => link.name}
      columns={columns}
      empty={t('empty')}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: links.length })}
        </Text>
      }
      onReorder={
        onReorder === undefined ? undefined : ordered => onReorder(ordered.map(link => link.id))
      }
      renderCell={(link, column) => {
        switch (column) {
          case 'site':
            return <Site link={link} />
          case 'description':
            return (
              <Text as="span" size="sm" tone="muted" className="line-clamp-2">
                {link.description}
              </Text>
            )
          case 'status':
            return (
              <Tag tone={link.visible ? 'success' : 'neutral'}>
                {t(link.visible ? 'status.shown' : 'status.hidden')}
              </Tag>
            )
          case 'updated':
            return <Time value={link.updated} format="relative" className="text-muted text-sm" />
          default:
            return (
              <LinkMenu
                link={link}
                busy={busy === link.id}
                onEdit={onEdit}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            )
        }
      }}
    />
  )
}
