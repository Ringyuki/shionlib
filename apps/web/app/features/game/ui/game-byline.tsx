import { Inline, Link, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { releaseDate, type GameHeader } from '../game'

export function GameByline({ game }: { game: GameHeader }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const format = useFormatter()
  const released = game.release_date_tba ? undefined : releaseDate(game)
  const developers = (game.developers ?? []).map(({ developer }) => (
    <Link key={developer.id} asChild className="font-medium">
      <RouterLink to={`/${locale}/developer/${developer.id}`} prefetch="intent">
        {developer.name}
      </RouterLink>
    </Link>
  ))
  return (
    <Inline gap="md" align="baseline">
      {developers.length > 0 && <Text size="sm">{format.list(developers)}</Text>}
      <Text size="sm" tone="muted">
        {released === undefined ? t('releaseTba') : t('released', { date: released })}
      </Text>
    </Inline>
  )
}
