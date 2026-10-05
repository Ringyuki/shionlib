import { Card, Image, Inline, Stack, Tag, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { labelOf } from '~/shared/i18n/labels'
import { developerNames, gameTitle, originalTitle, primaryCover, releaseDate } from '../game'

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
  const byline = [
    developerNames(game).join(' / '),
    released === undefined ? t('tba') : format.dateTime(released, { dateStyle: 'medium' }),
  ]
    .filter(part => part !== '')
    .join(' · ')
  const { resources } = game
  const platforms = (resources.platforms ?? []).map(key => labelOf(labels.platform, key))
  const languages = (resources.languages ?? []).map(key => labelOf(labels.language, key))

  return (
    <Card padded={false} className="hn-interactive overflow-hidden">
      <Link to={`/${locale}/game/${game.id}`} prefetch="intent">
        <Inline gap="md" align="start" wrap={false} className="p-3">
          <Image
            src={primaryCover(game)?.url}
            alt=""
            ratio={3 / 4}
            fit="cover"
            className="w-16 shrink-0 rounded-md"
          />
          <Stack gap="xs" className="min-w-0 flex-1">
            <Text weight="medium" truncate>
              {title}
            </Text>
            {original !== undefined && (
              <Text size="sm" tone="muted" truncate>
                {original}
              </Text>
            )}
            <Text size="sm" tone="muted" truncate>
              {byline}
            </Text>
            <Inline gap="xs" align="center">
              {resources.count === 0 ? (
                <Text size="sm" tone="faint">
                  {t('noResources')}
                </Text>
              ) : (
                <>
                  {[...platforms, ...languages].map(label => (
                    <Tag key={label} size="sm">
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
        </Inline>
      </Link>
    </Card>
  )
}
