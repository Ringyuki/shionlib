import {
  DataList,
  DropdownMenu,
  DropdownMenuItem,
  Empty,
  Image,
  Link,
  Text,
  toast,
} from '@hina-ui/react'
import { BookmarkMinus, Ellipsis, NotebookPen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useNavigation } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerNames, gamePath, gameTitle, primaryCover } from '~/features/game'
import { Button } from '~/shared/ui/button'
import { itemsPageSize, itemsSearch, type FavoriteItem, type Favorites } from '../favorite'
import { useItemRemoval } from '../use-item-removal'

type FavoriteItemsProps = {
  favorites: Favorites
  listId: number
  own: boolean
  header: ReactNode
  onEditNote: (item: FavoriteItem) => void
}

export function FavoriteItems({ favorites, listId, own, header, onEditNote }: FavoriteItemsProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const removal = useItemRemoval(listId)
  const turning =
    navigation.state === 'loading' && navigation.location.pathname === location.pathname
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
      items={favorites.items}
      itemKey="id"
      mediaRatio={3 / 4}
      manual
      pagination
      total={favorites.total}
      page={favorites.page}
      pageSize={itemsPageSize}
      onPageChange={page => void navigate({ search: itemsSearch(page) })}
      loading={turning || removal.pending}
      renderHeader={() => header}
      renderMedia={({ item }) => (
        <Image src={primaryCover(item.game)?.url} alt="" fit="cover" className="size-full" />
      )}
      renderTitle={({ item }) => (
        <Link asChild tone="neutral">
          <RouterLink to={gamePath(locale, item.game.id)} prefetch="intent">
            {gameTitle(item.game, locale)}
          </RouterLink>
        </Link>
      )}
      renderDescription={({ item }) =>
        (item.note ?? '').trim() === '' ? null : (
          <Text as="span" size="sm" className="break-words whitespace-pre-line">
            {item.note}
          </Text>
        )
      }
      renderMeta={({ item }) => (
        <>
          {developerNames(item.game).length > 0 && (
            <Text as="span" size="xs" tone="muted">
              {format.list(developerNames(item.game))}
            </Text>
          )}
          <Text as="span" size="xs" tone="faint">
            {t('added', {
              date: format.dateTime(new Date(item.added_at), { dateStyle: 'medium' }),
            })}
          </Text>
        </>
      )}
      renderActions={
        own
          ? ({ item }) => (
              <DropdownMenu
                label={t('itemActions')}
                align="end"
                content={
                  <>
                    <DropdownMenuItem icon={<NotebookPen />} onSelect={() => onEditNote(item)}>
                      {t('editNote')}
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<BookmarkMinus />} onSelect={() => void remove(item)}>
                      {t('removeItem')}
                    </DropdownMenuItem>
                  </>
                }
              >
                <Button
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  iconOnly
                  aria-label={t('itemActions')}
                >
                  <Ellipsis />
                </Button>
              </DropdownMenu>
            )
          : undefined
      }
      renderEmpty={() => <Empty title={t('emptyList')} size="sm" />}
    />
  )
}
