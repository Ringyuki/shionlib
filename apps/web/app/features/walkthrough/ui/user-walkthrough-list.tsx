import { DataList, Empty } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { entryList } from '~/shared/ui/entry-link'
import { userPageSize, type UserWalkthroughs } from '../walkthrough'
import { UserWalkthroughRow } from './user-walkthrough-row'

type UserWalkthroughListProps = { walkthroughs: UserWalkthroughs; own: boolean }

export function UserWalkthroughList({ walkthroughs, own }: UserWalkthroughListProps) {
  const t = useTranslations('walkthrough')
  const pages = usePageTurn()
  return (
    <DataList
      label={t('userList')}
      id={listStart}
      className={entryList.frame}
      items={walkthroughs.items}
      itemKey="id"
      divided={false}
      itemClass={entryList.item}
      minHeight={0}
      manual
      pagination
      total={walkthroughs.total}
      page={walkthroughs.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => <Empty title={t(own ? 'userEmptyOwn' : 'empty')} size="sm" />}
    >
      {({ item }) => <UserWalkthroughRow walkthrough={item} own={own} />}
    </DataList>
  )
}
