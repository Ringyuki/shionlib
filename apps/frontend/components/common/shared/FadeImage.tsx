'use client'

import Image, { ImageProps } from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { normalizeAspectRatio } from './helpers/aspect-ratio'

type Props = Omit<ImageProps, 'onLoadingComplete'> & {
  aspectRatio?: string
  localFile?: boolean
  wrapElement?: 'span' | 'div'
  autoAspectRatio?: boolean
  onImageLoadComplete?: (image: HTMLImageElement) => void
  showSkeleton?: boolean
  className?: string
  imageClassName?: string
  sizes?: string
}

export function FadeImage({
  aspectRatio,
  fill = true,
  localFile = false,
  wrapElement = 'div',
  autoAspectRatio = false,
  onImageLoadComplete,
  showSkeleton = true,
  className,
  imageClassName,
  sizes,
  ...props
}: Props) {
  const { onLoad: userOnLoad, ...imageProps } = props
  const [loaded, setLoaded] = useState(false)
  const [resolvedAspectRatio, setResolvedAspectRatio] = useState(() =>
    normalizeAspectRatio(aspectRatio),
  )
  const imageSrc = imageProps.src
  const ContainerElement = wrapElement === 'span' ? 'span' : 'div'
  const srcAsString = typeof imageSrc === 'string' ? imageSrc : imageSrc ? `${imageSrc}` : ''
  useEffect(() => {
    if (!srcAsString) return
    setLoaded(false)
  }, [srcAsString])
  useEffect(() => {
    setResolvedAspectRatio(normalizeAspectRatio(aspectRatio))
  }, [aspectRatio, srcAsString])
  const shouldBypass =
    !srcAsString ||
    typeof imageSrc !== 'string' ||
    srcAsString.startsWith('http') ||
    localFile ||
    srcAsString.includes('assets') ||
    srcAsString.includes('blob:') ||
    srcAsString.includes('data:image')
  const resolvedSrc = !imageSrc
    ? undefined
    : shouldBypass
      ? imageSrc
      : process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL! + srcAsString

  const syncAspectRatioFromImage = useCallback(
    (image?: HTMLImageElement | null) => {
      if (!image || !aspectRatio || !autoAspectRatio) return
      const { naturalWidth, naturalHeight } = image
      if (!naturalWidth || !naturalHeight) return
      setResolvedAspectRatio(`${naturalWidth} / ${naturalHeight}`)
    },
    [aspectRatio, autoAspectRatio],
  )

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
    const imageElement = event.currentTarget
    syncAspectRatioFromImage(imageElement)
    userOnLoad?.(event)
    onImageLoadComplete?.(imageElement)
  }
  const shouldShowSkeleton = Boolean(imageSrc)
  return (
    <ContainerElement
      className={cn(
        'relative w-full h-full overflow-hidden',
        wrapElement === 'span' ? 'inline-block' : '',
        className,
      )}
      style={resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}}
    >
      {showSkeleton && shouldShowSkeleton && (
        <Skeleton
          as={wrapElement}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
          className={cn(
            'pointer-events-none transition-opacity duration-300',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
      {imageSrc && (
        <Image
          {...imageProps}
          width={imageProps.width}
          height={imageProps.height}
          src={resolvedSrc || imageSrc}
          alt={imageProps.alt ?? ''}
          fill={fill}
          sizes={sizes || (fill ? '16vw' : undefined)}
          onLoad={handleLoad}
          className={cn(
            'object-cover transition-opacity duration-300 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            imageClassName,
          )}
        />
      )}
    </ContainerElement>
  )
}
