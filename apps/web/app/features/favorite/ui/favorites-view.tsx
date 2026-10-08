import { Empty, Grid } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { keepScroll } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { favoritesPath, type FavoriteItem, type Favorites } from '../favorite'
import { EditListDialog } from './edit-list-dialog'
import { FavoriteItems } from './favorite-items'
import { ListHeading } from './list-heading'
import { ListNav } from './list-nav'
import { NewListDialog } from './new-list-dialog'
import { NoteDialog } from './note-dialog'
import { RemoveListDialog } from './remove-list-dialog'

type Opened = 'create' | 'edit' | 'remove' | 'note' | undefined

type FavoritesViewProps = {
  favorites: Favorites
  own: boolean
}

export function FavoritesView({ favorites, own }: FavoritesViewProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const navigate = useNavigate()
  const [opened, setOpened] = useState<Opened>()
  const [noted, setNoted] = useState<FavoriteItem>()
  const { owner, lists, selected } = favorites
  const toggle = (dialog: Exclude<Opened, undefined>) => (open: boolean) =>
    setOpened(open ? dialog : undefined)
  const go = (listId?: number) =>
    void navigate(favoritesPath(locale, owner, listId), { state: keepScroll })
  const creation = own && (
    <NewListDialog open={opened === 'create'} onOpenChange={toggle('create')} onCreated={go} />
  )
  if (selected === undefined) {
    return (
      <>
        <Empty
          title={t(own ? 'noListsOwn' : 'noListsPublic')}
          actions={
            own && (
              <Button icon={<Plus />} onClick={() => setOpened('create')}>
                {t('newList')}
              </Button>
            )
          }
        />
        {creation}
      </>
    )
  }
  return (
    <>
      <Grid className="items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <ListNav
          owner={owner}
          lists={lists}
          selected={selected}
          onCreate={own ? () => setOpened('create') : undefined}
        />
        <FavoriteItems
          favorites={favorites}
          listId={selected.id}
          own={own}
          header={
            <ListHeading
              list={selected}
              total={favorites.total}
              onEdit={own ? () => setOpened('edit') : undefined}
              onRemove={own && !selected.default ? () => setOpened('remove') : undefined}
            />
          }
          onEditNote={item => {
            setNoted(item)
            setOpened('note')
          }}
        />
      </Grid>
      {creation}
      {own && (
        <>
          <EditListDialog list={selected} open={opened === 'edit'} onOpenChange={toggle('edit')} />
          <RemoveListDialog
            list={selected}
            open={opened === 'remove'}
            onOpenChange={toggle('remove')}
            onRemoved={() => go()}
          />
          <NoteDialog item={noted} open={opened === 'note'} onOpenChange={toggle('note')} />
        </>
      )}
    </>
  )
}
