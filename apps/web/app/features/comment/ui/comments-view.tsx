import { DataList, Empty, Select, Stack, Text } from '@hina-ui/react'
import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import { pageSize, searchInOrder, threadOrders, type CommentItem, type Comments } from '../comment'
import { threadOrderFrom } from '../comment.schema'
import { NewComment } from './comment-composer'
import { CommentThread } from './comment-thread'
import { RemoveCommentDialog } from './remove-comment-dialog'

type CommentsViewProps = {
  comments: Comments
  viewerId: number | undefined
}

export function CommentsView({ comments, viewerId }: CommentsViewProps) {
  const t = useTranslations('comment')
  const pages = usePageTurn()
  const [removed, setRemoved] = useState<CommentItem | undefined>(undefined)
  const [removing, setRemoving] = useState(false)
  const stay = useInPageNavigate()
  const location = useLocation()
  const { gameId, threads, total, count, page, order } = comments
  return (
    <Stack gap="lg">
      {viewerId === undefined ? (
        <Button
          loginRequired
          variant="outline"
          tone="neutral"
          icon={<MessageSquare />}
          className="self-start"
        >
          {t('signInToWrite')}
        </Button>
      ) : (
        <NewComment gameId={gameId} />
      )}
      <DataList
        label={t('list')}
        items={threads}
        itemKey="id"
        manual
        pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={pages.turnTo}
        loading={pages.turning}
        renderHeader={() => (
          <>
            <Text size="sm" tone="muted" className="tabular-nums">
              {t('count', { count })}
            </Text>
            <Select
              size="sm"
              aria-label={t('orderLabel')}
              value={order}
              onValueChange={value =>
                stay({ search: searchInOrder(location.search, threadOrderFrom(value)) })
              }
              options={threadOrders.map(value => ({ value, label: t(`order.${value}`) }))}
              className="w-36"
            />
          </>
        )}
        renderEmpty={() => <Empty icon={<MessageSquare />} title={t('empty')} size="sm" />}
      >
        {({ item }) => (
          <CommentThread
            gameId={gameId}
            thread={item}
            viewerId={viewerId}
            onRemove={comment => {
              setRemoved(comment)
              setRemoving(true)
            }}
          />
        )}
      </DataList>
      <RemoveCommentDialog comment={removed} open={removing} onOpenChange={setRemoving} />
    </Stack>
  )
}
