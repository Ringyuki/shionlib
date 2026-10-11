import { cn, DropdownMenu, DropdownMenuItem, Image, Inline, Stack, Text } from '@hina-ui/react'
import { BookmarkMinus, Ellipsis } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle, primaryCover, releaseDate } from '~/features/game'
import { Button } from '~/shared/ui/button'
import { entryLink } from '~/shared/ui/entry-link'
import type { FavoriteItem } from '../favorite'

type FavoriteTileProps = {
  item: FavoriteItem
  onRemove?: () => void
}

export function FavoriteTile({ item, onRemove }: FavoriteTileProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  const released = releaseDate(item.game)
  const title = gameTitle(item.game, locale)
  const year = (
    <Text size="xs" tone="faint" className="tabular-nums">
      {released === undefined ? '' : format.dateTime(released, { year: 'numeric' })}
    </Text>
  )
  return (
    <Stack gap="none" className="h-full">
      <Link
        to={gamePath(locale, item.game.id)}
        prefetch="intent"
        className={cn(entryLink, 'flex flex-1 flex-col gap-2 p-1.5')}
      >
        <Image
          src={primaryCover(item.game)?.url}
          alt=""
          ratio={3 / 4}
          fit="cover"
          className="rounded-md"
        />
        <Stack gap="none">
          <Text size="xs" weight="medium" className="line-clamp-2 break-words">
            {title}
          </Text>
          {onRemove === undefined && year}
        </Stack>
      </Link>
      {onRemove !== undefined && (
        <Inline align="center" justify="between" wrap={false} className="ps-1.5">
          {year}
          <DropdownMenu
            label={t('itemActionsOf', { title })}
            align="end"
            content={
              <DropdownMenuItem icon={<BookmarkMinus />} onSelect={onRemove}>
                {t('removeItem')}
              </DropdownMenuItem>
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
      )}
    </Stack>
  )
}
