import { cn, Image, Spoiler } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { coverRatio, imageSize, masked, primaryCover, type GameHeader } from '../game'

type GameCoverProps = {
  game: Pick<GameHeader, 'covers' | 'content_limit'>
  title: string
  className?: string
}

export function GameCover({ game, title, className }: GameCoverProps) {
  const t = useTranslations('game.cover')
  const cover = primaryCover(game)
  const image = (
    <Image
      src={cover?.url}
      alt={title}
      ratio={coverRatio(cover)}
      preview={cover !== undefined}
      previewSize={cover === undefined ? undefined : imageSize(cover)}
      eager
      className={className}
    />
  )
  return cover !== undefined && masked(cover, game.content_limit) ? (
    <Spoiler aria-label={t('explicit')} className={cn('block', className)}>
      {image}
    </Spoiler>
  ) : (
    image
  )
}
