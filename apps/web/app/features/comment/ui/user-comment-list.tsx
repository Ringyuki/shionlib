import { DataList, Empty } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { entryList } from '~/shared/ui/entry-link'
import { userPageSize, type UserComments } from '../comment'
import { UserCommentRow } from './user-comment-row'

type UserCommentListProps = { comments: UserComments; own: boolean }

export function UserCommentList({ comments, own }: UserCommentListProps) {
  const t = useTranslations('comment')
  const pages = usePageTurn()
  return (
    <DataList
      label={t('userList')}
      id={listStart}
      className={entryList.frame}
      items={comments.items}
      itemKey="id"
      divided={false}
      itemClass={entryList.item}
      minHeight={0}
      manual
      pagination
      total={comments.total}
      page={comments.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => <Empty title={t(own ? 'userEmptyOwn' : 'userEmpty')} size="sm" />}
    >
      {({ item }) => <UserCommentRow comment={item} />}
    </DataList>
  )
}
