import { Card, Inline, Stack, Tag, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { labelOf } from '~/shared/i18n/labels'
import { developerNames, gameTitle, originalTitle, releaseDate } from '../game'
import { GameCover } from './game-cover'
import { PlatformTag } from './platform-tag'

type GameRowProps = {
  game: Schema<'GameCardDTO'>
}

export function GameRow({ game }: GameRowProps) {
  const t = useTranslations('game')
  const labels = useMessages().game
  const locale = useLocale()
  const format = useFormatter()
  const title = gameTitle(game, locale)
  const original = originalTitle(game, locale)
  const released = releaseDate(game)
  const developers = developerNames(game)
  const { resources } = game
  const languages = (resources.languages ?? []).map(key => labelOf(labels.language, key))

  return (
    <Card padded={false} className="hn-interactive overflow-hidden">
      <Link to={`/${locale}/game/${game.id}`} prefetch="intent">
        <Inline gap="md" align="stretch" wrap={false} className="p-3">
          <GameCover game={game} className="w-22 shrink-0 rounded-md" />
          <Stack justify="between" className="min-w-0 flex-1">
            <Stack gap="xs">
              <Text weight="medium" truncate>
                {title}
              </Text>
              {original !== undefined && (
                <Text size="sm" tone="muted" truncate>
                  {original}
                </Text>
              )}
            </Stack>
            <Stack gap="xs">
              <Inline gap="md" wrap={false} className="min-w-0">
                {developers.length > 0 && (
                  <Text size="sm" tone="muted" truncate>
                    {format.list(developers)}
                  </Text>
                )}
                <Text size="sm" tone="faint" className="shrink-0">
                  {released === undefined
                    ? t('tba')
                    : format.dateTime(released, { dateStyle: 'medium' })}
                </Text>
              </Inline>
              <Inline gap="xs" align="center">
                {resources.count === 0 ? (
                  <Text size="sm" tone="faint">
                    {t('noResources')}
                  </Text>
                ) : (
                  <>
                    {(resources.platforms ?? []).map(platform => (
                      <PlatformTag key={platform} platform={platform} />
                    ))}
                    {languages.map(label => (
                      <Tag key={label} size="sm" variant="outline">
                        {label}
                      </Tag>
                    ))}
                    <Text size="sm" tone="muted">
                      {t('resources', { count: resources.count })}
                    </Text>
                  </>
                )}
              </Inline>
            </Stack>
          </Stack>
        </Inline>
      </Link>
    </Card>
  )
}
