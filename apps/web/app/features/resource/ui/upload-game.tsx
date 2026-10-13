import { Button, Inline, Stack, Text } from '@hina-ui/react'
import { useLocale, useTranslations } from 'use-intl'
import { GameCover, gameTitle, originalTitle, type GameHeader } from '~/features/game'
import { flushEnd } from '~/shared/ui/flush'

export function UploadGame({ game, onChange }: { game: GameHeader; onChange: () => void }) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const title = gameTitle(game, locale)
  const original = originalTitle(game, locale)
  return (
    <Inline gap="md" align="center" wrap={false}>
      <GameCover game={game} className="w-12 shrink-0 rounded-md" />
      <Stack gap="none" className="min-w-0 flex-1">
        <Text weight="medium" truncate>
          {title}
        </Text>
        {original !== undefined && (
          <Text size="sm" tone="muted" truncate>
            {original}
          </Text>
        )}
      </Stack>
      <Button size="sm" variant="ghost" tone="neutral" className={flushEnd.sm} onClick={onChange}>
        {t('changeGame')}
      </Button>
    </Inline>
  )
}
