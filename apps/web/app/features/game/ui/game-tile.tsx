import { Card, Inline, Stack, Tag, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { developerNames, gamePath, gameTitle, releaseDate, type GameSummary } from '../game'
import { GameCover } from './game-cover'

type GameTileProps = {
  game: GameSummary
  dated: 'day' | 'year'
  note?: ReactNode
}

export function GameTile({ game, dated, note }: GameTileProps) {
  const t = useTranslations('game')
  const labels = useMessages().game
  const locale = useLocale()
  const format = useFormatter()
  const released = releaseDate(game)
  const [developer] = developerNames(game)
  const languages = game.resources.languages ?? []
  const date =
    released === undefined
      ? t('tba')
      : format.dateTime(
          released,
          dated === 'day' ? { month: '2-digit', day: '2-digit' } : { year: 'numeric' },
        )

  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link to={gamePath(locale, game.id)} prefetch="intent" className="block h-full">
        <GameCover game={game} />
        <Stack gap="xs" className="p-2">
          <Text size="sm" weight="medium" className="line-clamp-2 min-h-[2lh]">
            {gameTitle(game, locale)}
          </Text>
          <Inline gap="sm" wrap={false} className="min-w-0">
            <Text size="xs" tone="faint" className="shrink-0 tabular-nums">
              {date}
            </Text>
            {developer !== undefined && (
              <Text size="xs" tone="muted" truncate>
                {developer}
              </Text>
            )}
          </Inline>
          {languages.length > 0 && (
            <Inline gap="xs">
              {languages.map(language => (
                <Tag key={language} size="sm" variant="outline">
                  {labelOf(labels.language, language)}
                </Tag>
              ))}
            </Inline>
          )}
          {note}
        </Stack>
      </Link>
    </Card>
  )
}
