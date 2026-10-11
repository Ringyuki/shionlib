import { cn, Image, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale } from 'use-intl'
import { gamePath, gameTitle, primaryCover, releaseDate } from '~/features/game'
import { entryLink } from '~/shared/ui/entry-link'
import type { FavoriteItem } from '../favorite'

export function FavoriteTile({ item }: { item: FavoriteItem }) {
  const locale = useLocale()
  const format = useFormatter()
  const released = releaseDate(item.game)
  return (
    <Link
      to={gamePath(locale, item.game.id)}
      prefetch="intent"
      className={cn(entryLink, 'flex h-full flex-col gap-2 p-1.5')}
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
          {gameTitle(item.game, locale)}
        </Text>
        {released !== undefined && (
          <Text size="xs" tone="faint" className="tabular-nums">
            {format.dateTime(released, { year: 'numeric' })}
          </Text>
        )}
      </Stack>
    </Link>
  )
}
