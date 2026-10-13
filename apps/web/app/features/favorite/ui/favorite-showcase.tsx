import { DataList, Empty, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { showcasePageSize, type Showcase } from '../favorite'
import { FavoriteTile } from './favorite-tile'
import { ListChips } from './list-chips'

type FavoriteShowcaseProps = {
  showcase: Showcase
  own: boolean
}

export function FavoriteShowcase({ showcase, own }: FavoriteShowcaseProps) {
  const t = useTranslations('favorite')
  const pages = usePageTurn()
  const { owner, lists, selected } = showcase
  if (selected === undefined) {
    return (
      <Empty title={t(own ? 'noListsPublicOwn' : 'noListsPublic')} size="sm" className="py-10" />
    )
  }
  const description = (selected.description ?? '').trim()
  return (
    <Stack gap="sm" className="px-2.5 pt-4 pb-5 sm:px-4.5">
      <Stack gap="sm" className="px-1.5">
        <ListChips owner={owner} lists={lists} selected={selected} />
        {description !== '' && (
          <Text tone="muted" className="break-words whitespace-pre-line">
            {description}
          </Text>
        )}
      </Stack>
      <DataList
        label={t('items')}
        id={listStart}
        className="scroll-mt-4"
        items={showcase.items}
        itemKey="id"
        layout="grid"
        contentClass="grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 xl:grid-cols-6"
        minHeight={0}
        manual
        pagination
        total={showcase.total}
        page={showcase.page}
        pageSize={showcasePageSize}
        onPageChange={pages.turnTo}
        loading={pages.turning}
        renderEmpty={() => <Empty title={t('emptyList')} size="sm" />}
      >
        {({ item }) => <FavoriteTile item={item} />}
      </DataList>
    </Stack>
  )
}
