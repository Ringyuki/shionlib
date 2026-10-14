import { Card, Center, cn, Image, Ripple, Tag } from '@hina-ui/react'
import { EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useTranslations } from 'use-intl'
import { useShowsExplicit } from '~/features/viewer'
import { imageSize, isExplicit, type GameImage } from '../game'

type GamePictureProps = Omit<
  ComponentProps<typeof Image>,
  'src' | 'ratio' | 'preview' | 'previewSize'
> & {
  picture: GameImage | undefined
  ratio: number
  preview?: boolean
}

const blurred = 'scale-150 blur-xl supports-[width:1cqw]:blur-[15cqw]'

const blurredByServer = 'scale-150'

export function GamePicture({
  picture,
  ratio,
  preview = false,
  className,
  imageClass,
  ...image
}: GamePictureProps) {
  const t = useTranslations('game.cover')
  const plain = useShowsExplicit()
  const [revealed, setRevealed] = useState<string>()
  const shown = revealed !== undefined && revealed === picture?.url
  if (picture?.masked === true) {
    return (
      <Image
        {...image}
        src={picture.url}
        ratio={ratio}
        className={cn('bg-inset', className)}
        imageClass={cn(imageClass, blurredByServer)}
      />
    )
  }
  if (picture === undefined || plain || !isExplicit(picture) || shown) {
    return (
      <Image
        {...image}
        {...(shown ? { lazy: false, eager: true } : {})}
        src={picture?.url}
        ratio={ratio}
        preview={preview}
        previewSize={picture === undefined ? undefined : imageSize(picture)}
        className={className}
        imageClass={imageClass}
      />
    )
  }
  if (!preview) {
    return (
      <Image
        {...image}
        src={picture.url}
        ratio={ratio}
        className={cn('bg-inset @container', className)}
        imageClass={cn(imageClass, blurred)}
      />
    )
  }
  const reveal = (event: MouseEvent<HTMLElement>) => {
    const mask = event.currentTarget
    const siblings = mask.parentElement?.children
    const position = [...(siblings ?? [])].indexOf(mask)
    flushSync(() => setRevealed(picture.url))
    const next = siblings?.[position]
    if (next instanceof HTMLElement) {
      next.focus()
    }
  }
  return (
    <Card
      as="button"
      padded={false}
      aria-label={t('explicit')}
      onClick={reveal}
      style={{ aspectRatio: ratio }}
      className={cn(
        'hn-interactive hn-state-layer hn-press-lg bg-inset @container relative block w-full overflow-hidden',
        className,
      )}
    >
      <Ripple />
      <Image
        {...image}
        src={picture.url}
        className="size-full"
        imageClass={cn(imageClass, blurred)}
      />
      <Center as="span" className="pointer-events-none absolute inset-0 z-20">
        <Tag size="sm">
          <EyeOff aria-hidden />
          {t('reveal')}
        </Tag>
      </Center>
    </Card>
  )
}
