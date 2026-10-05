import { Image, Lightbox } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { coverRatio, masked, primaryCover, type GameHeader } from '../game'
import { useGallery } from '../use-gallery'
import { GalleryThumb } from './gallery-thumb'

type GameCoversProps = {
  game: Pick<GameHeader, 'covers' | 'content_limit'>
  title: string
  className?: string
  imageClass?: string
  fill?: boolean
}

export function GameCovers({ game, title, className, imageClass, fill = false }: GameCoversProps) {
  const t = useTranslations('game.cover')
  const primary = primaryCover(game)
  const covers =
    primary === undefined
      ? []
      : [primary, ...(game.covers ?? []).filter(cover => cover !== primary)]
  const { thumb, show, lightbox } = useGallery(covers, () => title)
  if (primary === undefined) {
    return (
      <Image alt={title} ratio={fill ? undefined : coverRatio(undefined)} className={className} />
    )
  }
  return (
    <>
      <GalleryThumb
        src={primary.url}
        label={t('view')}
        ratio={fill ? undefined : coverRatio(primary)}
        masked={masked(primary, game.content_limit)}
        data={thumb(0)}
        onOpen={() => show(0)}
        eager
        className={className}
        imageClass={imageClass}
      />
      <Lightbox {...lightbox} />
    </>
  )
}
