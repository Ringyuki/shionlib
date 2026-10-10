import { Card, Image, Inline, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerNames, gamePath, gameTitle, primaryCover } from '~/features/game'
import type { GameRef } from '../walkthrough'

export function WalkthroughGame({ game, resources }: { game: GameRef; resources: number }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const format = useFormatter()
  const developers = developerNames(game)
  const facts = [
    ...(developers.length > 0 ? [format.list(developers)] : []),
    ...(resources > 0 ? [t('resources', { count: resources })] : []),
  ]
  return (
    <Card padded={false} className="hn-interactive overflow-hidden">
      <RouterLink to={gamePath(locale, game.id)} prefetch="intent">
        <Inline gap="md" align="center" wrap={false} className="p-3">
          <Image
            src={primaryCover(game)?.url}
            alt=""
            ratio={3 / 4}
            fit="cover"
            className="w-12 shrink-0 rounded-md"
          />
          <Stack gap="xs" className="min-w-0 flex-1">
            <Text size="sm" weight="medium" className="line-clamp-2 break-words">
              {gameTitle(game, locale)}
            </Text>
            {facts.length > 0 && (
              <Text size="xs" tone="muted" truncate>
                {facts.join(' · ')}
              </Text>
            )}
          </Stack>
        </Inline>
      </RouterLink>
    </Card>
  )
}
