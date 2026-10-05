import { Heading, Stack, Text, Tooltip } from '@hina-ui/react'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle, originalTitle, type GameHeader } from '../game'

const shownAliases = 3

export function GameTitle({ game, className }: { game: GameHeader; className?: string }) {
  const locale = useLocale()
  const title = gameTitle(game, locale)
  const original = originalTitle(game, locale)
  return (
    <Stack gap="xs" className={className}>
      <Heading level={1} size="2xl" weight="semibold" className="text-balance max-sm:text-xl">
        {title}
      </Heading>
      {original !== undefined && (
        <Text size="lg" tone="muted" className="text-balance max-sm:text-base">
          {original}
        </Text>
      )}
      <Aliases aliases={game.aliases ?? []} />
    </Stack>
  )
}

function Aliases({ aliases }: { aliases: readonly string[] }) {
  const t = useTranslations('game.facts')
  if (aliases.length === 0) {
    return null
  }
  const shown = aliases.slice(0, shownAliases)
  const hidden = aliases.length - shown.length
  return (
    <Text size="sm" tone="faint">
      {shown.join(' · ')}
      {hidden > 0 && (
        <>
          {' '}
          <Tooltip content={aliases.join(' · ')}>
            <Text
              as="span"
              size="sm"
              tone="faint"
              tabIndex={0}
              className="cursor-help whitespace-nowrap underline decoration-dotted"
            >
              {t('moreAliases', { count: hidden })}
            </Text>
          </Tooltip>
        </>
      )}
    </Text>
  )
}
