'use client'

import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
import { FadeImage } from './FadeImage'
import { useEffect } from 'react'
import { cn } from '@/utils/cn'

interface ZoomImageProps {
  src: string
  alt: string
  aspectRatio?: string
  wrapElement?: 'span' | 'div'
  className?: string
}

export const ZoomImage = ({
  src,
  alt,
  aspectRatio,
  wrapElement = 'div',
  className,
}: ZoomImageProps) => {
  const handleZoomChange = (isZoomed: boolean) => {
    try {
      const body = document.body
      if (isZoomed) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        body.setAttribute('data-scroll-locked', 'true')
        body.style.setProperty('--removed-body-scroll-bar-size', `${scrollbarWidth}px`)
      }
    } catch {}
  }

  const ZoomContentInner = ({ data }: { data: any }) => {
    const { modalState, img, buttonUnzoom } = data
    useEffect(() => {
      if (modalState === 'UNLOADED') {
        try {
          const body = document.body
          body.removeAttribute('data-scroll-locked')
          body.style.removeProperty('--removed-body-scroll-bar-size')
        } catch {}
      }
    }, [modalState])
    return (
      <>
        {img}
        {buttonUnzoom}
      </>
    )
  }

  const renderZoomContent = (data: any) => <ZoomContentInner data={data} />
  return (
    <Zoom
      key={src}
      wrapElement={wrapElement}
      classDialog="rmiz-dialog"
      onZoomChange={handleZoomChange}
      ZoomContent={renderZoomContent}
    >
      <FadeImage
        src={src}
        alt={alt}
        className={cn('w-full h-full rounded-md', className)}
        aspectRatio={aspectRatio}
        wrapElement={wrapElement}
      />
    </Zoom>
  )
}
