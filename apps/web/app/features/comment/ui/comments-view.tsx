import { DataList, Empty, SegmentedControl, Stack } from '@hina-ui/react'
import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import {
  pageSize,
  searchInOrder,
  threadOrders,
  type CommentItem,
  type Comments,
  type Writer,
} from '../comment'
import { threadOrderFrom } from '../comment.schema'
import { usePinning } from '../use-pinning'
import { CommentThread } from './comment-thread'
import { GuestComment } from './guest-comment'
import { NewComment } from './new-comment'
import { RemoveCommentDialog } from './remove-comment-dialog'
import { ReplacePinDialog } from './replace-pin-dialog'

type CommentsViewProps = {
  comments: Comments
  writer: Writer | undefined
  publisherId?: number
}

export function CommentsView({ comments, writer, publisherId }: CommentsViewProps) {
  const t = useTranslations('comment')
  const pages = usePageTurn()
  const [invited, setInvited] = useState(false)
  const [removed, setRemoved] = useState<CommentItem | undefined>(undefined)
  const [removing, setRemoving] = useState(false)
  const stay = useInPageNavigate()
  const ask = useCallback((comment: CommentItem) => {
    setRemoved(comment)
    setRemoving(true)
  }, [])
  const location = useLocation()
  const { place, threads, total, page, order } = comments
  const pinning = usePinning(comments.pinned)
  return (
    <Stack as="section" gap="xl">
      {writer === undefined ? (
        <GuestComment onSignedIn={() => setInvited(true)} />
      ) : (
        <NewComment place={place} writer={writer} autoFocus={invited} />
      )}
      <DataList
        label={t('list')}
        id={listStart}
        className="scroll-mt-4"
        items={threads}
        itemKey="id"
        divided={false}
        itemClass="py-1"
        manual
        pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={pages.turnTo}
        loading={pages.turning}
        renderHeader={
          total > 1
            ? () => (
                <SegmentedControl
                  size="sm"
                  aria-label={t('orderLabel')}
                  value={order}
                  onValueChange={value =>
                    stay({ search: searchInOrder(location.search, threadOrderFrom(value)) })
                  }
                  options={threadOrders.map(value => ({ value, label: t(`order.${value}`) }))}
                />
              )
            : undefined
        }
        renderEmpty={() => <Empty title={t('empty')} />}
      >
        {({ item }) => (
          <CommentThread
            place={place}
            publisherId={publisherId}
            thread={item}
            writer={writer}
            onRemove={ask}
            onPin={pinning.pin}
            onUnpin={pinning.unpin}
          />
        )}
      </DataList>
      <RemoveCommentDialog comment={removed} open={removing} onOpenChange={setRemoving} />
      <ReplacePinDialog
        open={pinning.asking}
        onOpenChange={pinning.setAsking}
        onConfirm={pinning.replace}
      />
    </Stack>
  )
}
