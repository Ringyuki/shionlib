import { Card, Image, Inline, Stack, Tag, Text, Time } from '@hina-ui/react'
import { Hash } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { useBytes } from '~/shared/i18n/use-bytes'
import {
  developerNames,
  gamePath,
  gameTitle,
  originalTitle,
  primaryCover,
  releaseDate,
  type GameSummary,
} from '../game'
import { PlatformTag } from './platform-tag'

export function GameCard({ game }: { game: GameSummary }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const format = useFormatter()
  const original = originalTitle(game, locale)
  const released = releaseDate(game)
  const developers = developerNames(game)
  const tags = game.tags ?? []

  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link to={gamePath(locale, game.id)} prefetch="intent" className="block h-full">
        <Stack gap="sm" justify="between" className="h-full p-3">
          <Inline gap="md" align="start" wrap={false}>
            <Image
              src={primaryCover(game)?.url}
              alt=""
              ratio={3 / 4}
              fit="cover"
              className="w-18.75 shrink-0 rounded-md"
            />
            <Stack gap="xs" className="min-w-0">
              <Text weight="medium" className="line-clamp-2">
                {gameTitle(game, locale)}
              </Text>
              {original !== undefined && (
                <Text size="sm" tone="muted" truncate>
                  {original}
                </Text>
              )}
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
              {tags.length > 0 && (
                <Inline gap="xs">
                  {tags.map(tag => (
                    <Tag key={tag.id} size="sm" className="max-w-full">
                      <Hash aria-hidden />
                      <Text as="span" size="xs" truncate>
                        {tag.name}
                      </Text>
                    </Tag>
                  ))}
                </Inline>
              )}
            </Stack>
          </Inline>
          <ResourceSummary resources={game.resources} />
        </Stack>
      </Link>
    </Card>
  )
}

function ResourceSummary({ resources }: { resources: GameSummary['resources'] }) {
  const t = useTranslations('game')
  const labels = useMessages().game
  const bytes = useBytes()
  const { latest } = resources
  if (latest === null) {
    return (
      <Text size="sm" tone="faint">
        {t('noResources')}
      </Text>
    )
  }
  return (
    <Stack gap="xs">
      <Inline gap="xs" align="center">
        {(latest.platforms ?? []).map(platform => (
          <PlatformTag key={platform} platform={platform} />
        ))}
        {(latest.languages ?? []).map(language => (
          <Tag key={language} size="sm" variant="outline">
            {labelOf(labels.language, language)}
          </Tag>
        ))}
        <Text size="xs" tone="muted" className="tabular-nums">
          {bytes(latest.size)}
        </Text>
      </Inline>
      <Inline gap="md" align="center" wrap={false}>
        <Text size="xs" tone="muted" className="shrink-0">
          {t('resources', { count: resources.count })}
        </Text>
        <Text size="xs" tone="muted" className="min-w-0 flex-1 tabular-nums" truncate>
          {t('downloads', { count: resources.downloads })}
        </Text>
        <Text size="xs" tone="faint" className="shrink-0">
          {t.rich('updated', { time: () => <Time value={latest.at} format="relative" /> })}
        </Text>
      </Inline>
    </Stack>
  )
}
