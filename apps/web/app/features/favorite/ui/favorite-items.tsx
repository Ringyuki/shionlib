import { DataList, Empty, toast } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { entryList } from '~/shared/ui/entry-link'
import { itemsPageSize, type FavoriteItem, type Favorites } from '../favorite'
import { useItemRemoval } from '../use-item-removal'
import { FavoriteEntry } from './favorite-entry'

type FavoriteItemsProps = {
  favorites: Favorites
  listId: number
  header: ReactNode
  onEditNote: (item: FavoriteItem) => void
}

export function FavoriteItems({ favorites, listId, header, onEditNote }: FavoriteItemsProps) {
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
      divided={false}
      itemClass={entryList.item}
      manual
      pagination
      total={favorites.total}
      page={favorites.page}
      pageSize={itemsPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning || removal.pending}
      renderHeader={() => header}
      renderEmpty={() => <Empty title={t('emptyList')} size="sm" />}
    >
      {({ item }) => (
        <FavoriteEntry
          item={item}
          onEditNote={() => onEditNote(item)}
          onRemove={() => void remove(item)}
        />
      )}
    </DataList>
  )
}
