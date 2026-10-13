import { Stack, Text, Time } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  ModerationVerdict,
  RecordTable,
  UserRef,
  titleOf,
  type Paging,
  type RecordColumn,
} from '~/features/admin'
import type { Comment } from '../admin-comment'

type CommentTableProps = {
  comments: Comment[]
  paging: Paging
  filtered: boolean
  selected: number[]
  onSelectedChange: (selected: number[]) => void
  onOpen: (comment: Comment) => void
}

export function CommentTable(props: CommentTableProps) {
  const { comments, paging, filtered, selected, onSelectedChange, onOpen } = props
  const t = useTranslations('adminComment')
  const shared = useTranslations('admin')
  const columns: RecordColumn[] = [
    { key: 'comment', label: t('column.comment'), fill: true },
    { key: 'author', label: t('column.author'), wide: true },
    { key: 'game', label: t('column.game'), wide: true, className: 'w-[20%] min-w-40' },
    { key: 'verdict', label: t('column.verdict') },
    { key: 'time', label: t('column.time'), wide: true },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={comments}
      rowKey={comment => comment.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={onOpen}
      selected={selected}
      onSelectedChange={keys =>
        onSelectedChange(comments.map(comment => comment.id).filter(id => keys.includes(id)))
      }
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(comment, column) => {
        switch (column) {
          case 'comment':
            return (
              <Stack gap="none" className="min-w-0">
                <Text as="span" size="sm" className="line-clamp-2 break-words">
                  {comment.text}
                </Text>
                <Text as="span" size="sm" tone="muted" className="line-clamp-1 break-all md:hidden">
                  {t.rich('narrow', {
                    author: comment.creator.name,
                    game: titleOf(comment.game),
                    time: () => <Time value={comment.created} format="relative" tooltip={false} />,
                  })}
                </Text>
              </Stack>
            )
          case 'author':
            return <UserRef user={comment.creator} />
          case 'game':
            return (
              <Text as="span" size="sm" tone="muted" className="line-clamp-2 break-words">
                {titleOf(comment.game)}
              </Text>
            )
          case 'verdict':
            return <ModerationVerdict verdict={comment.moderation} />
          default:
            return <Time value={comment.created} format="relative" className="text-muted text-sm" />
        }
      }}
    />
  )
}
