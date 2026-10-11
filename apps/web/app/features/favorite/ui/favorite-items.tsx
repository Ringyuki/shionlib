import { DataList, Empty, toast } from '@hina-ui/react'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { itemsPageSize, type FavoriteItem, type Favorites } from '../favorite'
import { useItemRemoval } from '../use-item-removal'
import { FavoriteTile } from './favorite-tile'

type FavoriteItemsProps = {
  favorites: Favorites
  listId: number
  own: boolean
}

export function FavoriteItems({ favorites, listId, own }: FavoriteItemsProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const pages = usePageTurn()
  const removal = useItemRemoval(listId)
  const remove = async (item: FavoriteItem) => {
    const outcome = await removal.remove(item)
    if (outcome.ok) {
      toast(t('itemRemoved', { title: gameTitle(item.game, locale) }), {
        action: { label: t('undo'), onClick: () => void removal.restore(item) },
      })
    }
  }
  return (
    <DataList
      label={t('items')}
      id={listStart}
      className="scroll-mt-4"
      items={favorites.items}
      itemKey="id"
      layout="grid"
      contentClass="grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 xl:grid-cols-6"
      minHeight={0}
      manual
      pagination
      total={favorites.total}
      page={favorites.page}
      pageSize={itemsPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning || removal.pending}
      renderEmpty={() => <Empty title={t('emptyList')} size="sm" />}
    >
      {({ item }) => (
        <FavoriteTile item={item} onRemove={own ? () => void remove(item) : undefined} />
      )}
    </DataList>
  )
}
