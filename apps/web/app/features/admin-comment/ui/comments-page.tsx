import { Card, Inline, PageHeader, Stack, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { pageSize } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  fallbackCategory,
  narrowed,
  searchOf,
  searchWith,
  visible,
  type Narrowing,
} from '../admin-comment'
import type { Listing } from '../admin-comment.use-cases'
import { useCommentChange } from '../use-comment-change'
import { BlockDialog } from './block-dialog'
import { CommentPane } from './comment-pane'
import { CommentTable } from './comment-table'
import { BulkBar, CommentFilters } from './comments-toolbar'

export function CommentsPage({ filter, comments, total, opened }: Listing) {
  const t = useTranslations('adminComment')
  const location = useLocation()
  const stay = useInPageNavigate()
  const [selected, setSelected] = useState<number[]>([])
  const [blocking, setBlocking] = useState(false)
  const change = useCommentChange()
  const chosen = selected.filter(id => comments.some(comment => comment.id === id))
  const show = (changes: Partial<Narrowing>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline
          gap="sm"
          align="center"
          className="border-line min-h-14 border-b px-(--hn-panel-p) py-3"
        >
          {chosen.length === 0 ? (
            <CommentFilters filter={filter} authorName={comments[0]?.creator.name} onShow={show} />
          ) : (
            <BulkBar
              count={chosen.length}
              busy={change.pending}
              onClear={() => setSelected([])}
              onBlock={() => setBlocking(true)}
              onApprove={async () => {
                const outcome = await change.run({
                  action: 'review',
                  ids: chosen,
                  status: visible,
                  category: fallbackCategory,
                  reason: '',
                  notify: false,
                })
                if (outcome.ok) {
                  setSelected([])
                  toast.success(t('bulk.approved', { count: chosen.length }))
                }
              }}
            />
          )}
        </Inline>
        <CommentTable
          comments={comments}
          paging={{ page: filter.page, pageSize, total }}
          filtered={narrowed(filter)}
          selected={chosen}
          onSelectedChange={setSelected}
          onOpen={comment => stay({ search: searchWith(location.search, comment.id) })}
        />
      </Card>
      <CommentPane
        opened={opened}
        onClose={() => stay({ search: searchWith(location.search, undefined) })}
      />
      <BlockDialog
        ids={chosen}
        open={blocking}
        onOpenChange={setBlocking}
        onDone={() => setSelected([])}
      />
    </Stack>
  )
}
