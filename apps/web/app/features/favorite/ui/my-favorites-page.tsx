import { Empty, PageHeader, Result, Stack } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { Button } from '~/shared/ui/button'
import { favoritesPath, type Favorites } from '../favorite'
import { MyFavorites } from './my-favorites'
import { NewListDialog } from './new-list-dialog'

type MyFavoritesPageProps = {
  favorites: Favorites
  signedIn: boolean
}

export function MyFavoritesPage({ favorites, signedIn }: MyFavoritesPageProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const stay = useInPageNavigate()
  const [creating, setCreating] = useState(false)
  const { selected } = favorites
  return (
    <Stack gap="lg">
      <PageHeader
        title={t('mine')}
        actions={
          signedIn && (
            <Button
              variant="outline"
              tone="neutral"
              icon={<Plus />}
              onClick={() => setCreating(true)}
            >
              {t('newList')}
            </Button>
          )
        }
      />
      {!signedIn ? (
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      ) : selected === undefined ? (
        <Empty title={t('noListsOwn')} />
      ) : (
        <MyFavorites favorites={favorites} selected={selected} />
      )}
      {signedIn && (
        <NewListDialog
          open={creating}
          onOpenChange={setCreating}
          onCreated={listId => stay(favoritesPath(locale, listId))}
        />
      )}
    </Stack>
  )
}
