import { Empty, Stack, Text } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { Button } from '~/shared/ui/button'
import { favoritesPath, type Favorites } from '../favorite'
import { EditListDialog } from './edit-list-dialog'
import { FavoriteItems } from './favorite-items'
import { ListActions } from './list-actions'
import { ListChips } from './list-chips'
import { NewListDialog } from './new-list-dialog'
import { RemoveListDialog } from './remove-list-dialog'

type Opened = 'create' | 'edit' | 'remove' | undefined

type FavoritesViewProps = {
  favorites: Favorites
  own: boolean
}

export function FavoritesView({ favorites, own }: FavoritesViewProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const stay = useInPageNavigate()
  const [opened, setOpened] = useState<Opened>()
  const { owner, lists, selected } = favorites
  const description = (selected?.description ?? '').trim()
  const toggle = (dialog: Exclude<Opened, undefined>) => (open: boolean) =>
    setOpened(open ? dialog : undefined)
  const go = (listId?: number) => stay(favoritesPath(locale, owner, listId))
  const creation = own && (
    <NewListDialog open={opened === 'create'} onOpenChange={toggle('create')} onCreated={go} />
  )
  if (selected === undefined) {
    return (
      <>
        <Empty
          title={t(own ? 'noListsOwn' : 'noListsPublic')}
          size="sm"
          className="py-10"
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
      <Stack gap="sm" className="px-2.5 pt-4 pb-5 md:px-4.5">
        <Stack gap="sm" className="px-1.5">
          <ListChips
            owner={owner}
            lists={lists}
            selected={selected}
            actions={
              own && (
                <ListActions
                  onCreate={() => setOpened('create')}
                  onEdit={() => setOpened('edit')}
                  onRemove={selected.default ? undefined : () => setOpened('remove')}
                />
              )
            }
          />
          {description !== '' && (
            <Text tone="muted" className="break-words whitespace-pre-line">
              {description}
            </Text>
          )}
        </Stack>
        <FavoriteItems favorites={favorites} listId={selected.id} own={own} />
      </Stack>
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
        </>
      )}
    </>
  )
}
