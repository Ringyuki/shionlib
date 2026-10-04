import { Heading, Image, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { useImageUrl } from '~/shared/ui/image-base'
import { gameTitle, primaryCover } from '../game'

type GameHeaderProps = {
  game: Schema<'GameHeaderDTO'>
  actions?: ReactNode
}

export function GameHeader({ game, actions }: GameHeaderProps) {
  const t = useTranslations('game')
  const locale = useLocale()
  const image = useImageUrl()
  const title = gameTitle(game, locale)
  const cover = primaryCover(game)
  return (
    <Inline gap="lg" align="start" wrap>
      <Image
        src={image(cover?.url)}
        alt={title}
        ratio={3 / 4}
        fit="cover"
        className="w-48 rounded-lg"
      />
      <Stack gap="sm" className="min-w-0 flex-1">
        <Heading level={1} size="2xl">
          {title}
        </Heading>
        {game.title_jp !== title && <Text tone="muted">{game.title_jp}</Text>}
        <Text size="sm" tone="muted">
          {game.release_date_tba || game.release_date === null
            ? t('releaseTba')
            : t('released', { date: new Date(game.release_date) })}
        </Text>
        <Inline gap="sm" className="pt-2">
          {actions}
        </Inline>
      </Stack>
    </Inline>
  )
}
