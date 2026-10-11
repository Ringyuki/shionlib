import { Grid } from '@hina-ui/react'
import { useState } from 'react'
import { useLocale } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { favoritesPath, type FavoriteItem, type FavoriteList, type Favorites } from '../favorite'
import { EditListDialog } from './edit-list-dialog'
import { FavoriteItems } from './favorite-items'
import { ListHeading } from './list-heading'
import { ListNav } from './list-nav'
import { NoteDialog } from './note-dialog'
import { RemoveListDialog } from './remove-list-dialog'

type Opened = 'edit' | 'remove' | 'note' | undefined

type MyFavoritesProps = {
  favorites: Favorites
  selected: FavoriteList
}

export function MyFavorites({ favorites, selected }: MyFavoritesProps) {
  const locale = useLocale()
  const stay = useInPageNavigate()
  const [opened, setOpened] = useState<Opened>()
  const [noted, setNoted] = useState<FavoriteItem>()
  const toggle = (dialog: Exclude<Opened, undefined>) => (open: boolean) =>
    setOpened(open ? dialog : undefined)
  return (
    <>
      <Grid className="items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <ListNav lists={favorites.lists} selected={selected} />
        <FavoriteItems
          favorites={favorites}
          listId={selected.id}
          header={
            <ListHeading
              list={selected}
              total={favorites.total}
              onEdit={() => setOpened('edit')}
              onRemove={selected.default ? undefined : () => setOpened('remove')}
            />
          }
          onEditNote={item => {
            setNoted(item)
            setOpened('note')
          }}
        />
      </Grid>
      <EditListDialog list={selected} open={opened === 'edit'} onOpenChange={toggle('edit')} />
      <RemoveListDialog
        list={selected}
        open={opened === 'remove'}
        onOpenChange={toggle('remove')}
        onRemoved={() => stay(favoritesPath(locale))}
      />
      <NoteDialog item={noted} open={opened === 'note'} onOpenChange={toggle('note')} />
    </>
  )
}
