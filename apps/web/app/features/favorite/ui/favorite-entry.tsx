import { cn, DropdownMenu, DropdownMenuItem, Image, Inline, Stack, Text } from '@hina-ui/react'
import { BookmarkMinus, Ellipsis, NotebookPen } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerNames, gamePath, gameTitle, primaryCover } from '~/features/game'
import { Button } from '~/shared/ui/button'
import { entryLink } from '~/shared/ui/entry-link'
import type { FavoriteItem } from '../favorite'

type FavoriteEntryProps = {
  item: FavoriteItem
  onEditNote: () => void
  onRemove: () => void
}

export function FavoriteEntry({ item, onEditNote, onRemove }: FavoriteEntryProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  const title = gameTitle(item.game, locale)
  const developers = developerNames(item.game)
  const note = (item.note ?? '').trim()
  return (
    <Inline gap="sm" align="center" wrap={false} className="-ms-3">
      <Link
        to={gamePath(locale, item.game.id)}
        prefetch="intent"
        className={cn(entryLink, 'flex min-w-0 flex-1 gap-4 p-3')}
      >
        <Image
          src={primaryCover(item.game)?.url}
          alt=""
          ratio={3 / 4}
          fit="cover"
          className="w-13.5 shrink-0 rounded-md md:w-15"
        />
        <Stack gap="xs" justify="center" className="min-w-0 flex-1">
          <Text weight="medium" className="break-words">
            {title}
          </Text>
          {note !== '' && (
            <Text size="sm" className="break-words whitespace-pre-line">
              {note}
            </Text>
          )}
          <Inline align="center" className="gap-x-4 gap-y-1">
            {developers.length > 0 && (
              <Text size="xs" tone="muted">
                {format.list(developers)}
              </Text>
            )}
            <Text size="xs" tone="faint">
              {t('added', {
                date: format.dateTime(new Date(item.added_at), { dateStyle: 'medium' }),
              })}
            </Text>
          </Inline>
        </Stack>
      </Link>
      <DropdownMenu
        label={t('itemActionsOf', { title })}
        align="end"
        content={
          <>
            <DropdownMenuItem icon={<NotebookPen />} onSelect={onEditNote}>
              {t('editNote')}
            </DropdownMenuItem>
            <DropdownMenuItem icon={<BookmarkMinus />} onSelect={onRemove}>
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
          aria-label={t('itemActionsOf', { title })}
        >
          <Ellipsis />
        </Button>
      </DropdownMenu>
    </Inline>
  )
}
