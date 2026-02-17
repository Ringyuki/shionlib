'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useDisableZoom } from '@/hooks/useDisableZoom'
import { useRestoreBodyPointerEvents } from '@/hooks/useRestoreBodyPointerEvents'
import { ImageLightboxGalleryContext } from './ImageLightboxGalleryContext'
import {
  calculateTargetSize,
  isMobile,
  loadImageDimensions,
  resolveOriginalSrc,
} from './utils/imageLightbox'

interface ImageLightboxProps {
  src: string
  alt?: string
  className?: string
  imageClassName?: string
  aspectRatio?: string
  children?: React.ReactNode
  lightboxMaxSize?: number
  maxWidth?: number
  wrapElement?: 'span' | 'div'
  autoAspectRatio?: boolean
  hideTriggerWhileOpen?: boolean
  sizes?: string
}

const ImageLightbox = React.forwardRef<HTMLElement, ImageLightboxProps>(
  (
    {
      src,
      alt = '',
      className,
      imageClassName,
      aspectRatio,
      children,
      lightboxMaxSize = isMobile() ? 0.9 : 0.6,
      maxWidth = 1024,
      wrapElement = 'div',
      autoAspectRatio = true,
      hideTriggerWhileOpen = true,
      sizes,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [shouldShow, setShouldShow] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)
    const [userScale, setUserScale] = React.useState(1)
    const [mounted, setMounted] = React.useState(false)
    const containerRef = React.useRef<HTMLElement>(null)
    const [imageBounds, setImageBounds] = React.useState<DOMRect | null>(null)
    const [imageNaturalSize, setImageNaturalSize] = React.useState<{
      width: number
      height: number
    } | null>(null)
    const [displaySrc, setDisplaySrc] = React.useState<string>('')
    const [targetSize, setTargetSize] = React.useState<{
      width: number
      height: number
    } | null>(null)
    const [isLoadingOriginal, setIsLoadingOriginal] = React.useState(false)
    const galleryContext = React.useContext(ImageLightboxGalleryContext)
    const lightboxId = React.useId()
    const t = useTranslations('Components.ShionUI.ImageLightbox')

    React.useImperativeHandle(ref, () => containerRef.current as HTMLElement)

    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (!galleryContext) return
      const unregister = galleryContext.registerItem({
        id: lightboxId,
        src,
        alt,
        aspectRatio,
        lightboxMaxSize,
        maxWidth,
        getContainer: () => containerRef.current,
        getImage: () => containerRef.current?.querySelector('img') ?? null,
      })
      return unregister
    }, [galleryContext, lightboxId, src, alt, aspectRatio, lightboxMaxSize, maxWidth])

    const handleOpen = () => {
      if (galleryContext) {
        galleryContext.openItem(lightboxId)
        return
      }

      if (containerRef.current) {
        const imgElement = containerRef.current.querySelector('img')
        const bounds =
          imgElement?.getBoundingClientRect() ?? containerRef.current.getBoundingClientRect()

        // get optimized src (loaded image on the page)
        // use currentSrc instead of src, because Next.js Image will generate different w= parameters based on the viewport
        // currentSrc returns the current actual rendered image URL, which can hit browser cache
        const optimizedSrc = imgElement?.currentSrc || imgElement?.src || resolveOriginalSrc(src)

        const currentWidth = imgElement?.naturalWidth || imgElement?.width || bounds?.width || 0
        const currentHeight = imgElement?.naturalHeight || imgElement?.height || bounds?.height || 0

        if (bounds && currentWidth && currentHeight) {
          setImageBounds(bounds)
          setDisplaySrc(optimizedSrc)
          setImageNaturalSize({ width: currentWidth, height: currentHeight })
          setTargetSize(calculateTargetSize(currentWidth, currentHeight, lightboxMaxSize, maxWidth))
          setIsOpen(true)
          setShouldShow(true)
          setIsAnimating(true)
        }

        setUserScale(1)

        // load original image in background
        const originalSrc = resolveOriginalSrc(src)
        if (originalSrc !== optimizedSrc) {
          setIsLoadingOriginal(true)
          loadImageDimensions(originalSrc)
            .then(dimensions => {
              setImageNaturalSize({ width: dimensions.width, height: dimensions.height })
              setTargetSize(
                calculateTargetSize(dimensions.width, dimensions.height, lightboxMaxSize, maxWidth),
              )
              setDisplaySrc(originalSrc)
            })
            .catch(error => {
              console.warn('[ImageLightbox] Failed to load original image', error)
            })
            .finally(() => {
              setIsLoadingOriginal(false)
            })
        }
      }
    }

    const handleClose = () => {
      setShouldShow(false)
      setUserScale(1)
    }

    const handleExitComplete = () => {
      setIsAnimating(false)
      setIsOpen(false)
    }

    const imageRef = React.useRef<HTMLImageElement>(null)

    const handleWheel = React.useCallback((e: WheelEvent) => {
      e.preventDefault()
      setUserScale(prev => {
        const delta = e.deltaY * -0.001
        const newScale = prev + delta
        return Math.min(Math.max(0.5, newScale), 5)
      })
    }, [])

    React.useEffect(() => {
      const imgElement = imageRef.current
      if (imgElement && isOpen) {
        imgElement.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
          imgElement.removeEventListener('wheel', handleWheel)
        }
      }
    }, [isOpen, handleWheel])

    React.useEffect(() => {
      if (isOpen) {
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            handleClose()
          }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen])

    useScrollLock(isOpen)
    useDisableZoom(isOpen)
    useRestoreBodyPointerEvents(isOpen)
    const WrapElement = wrapElement
    const isActiveInGallery = galleryContext?.activeItemId === lightboxId
    const shouldHideTrigger =
      hideTriggerWhileOpen && (galleryContext ? isActiveInGallery : isAnimating)

    return (
      <>
        {children ? (
          <WrapElement
            ref={containerRef as any}
            onClick={handleOpen}
            className={className}
            style={{
              visibility: shouldHideTrigger ? 'hidden' : 'visible',
            }}
          >
            {children}
          </WrapElement>
        ) : (
          <WrapElement
            ref={containerRef as any}
            onClick={handleOpen}
            className={className}
            style={{
              cursor: 'zoom-in',
              visibility: shouldHideTrigger ? 'hidden' : 'visible',
            }}
          >
            <FadeImage
              src={src}
              alt={alt}
              aspectRatio={aspectRatio}
              wrapElement={wrapElement}
              imageClassName={imageClassName}
              autoAspectRatio={autoAspectRatio}
              sizes={sizes}
            />
          </WrapElement>
        )}

        {!galleryContext &&
          mounted &&
          createPortal(
            <AnimatePresence onExitComplete={handleExitComplete}>
              {shouldShow &&
                imageBounds &&
                imageNaturalSize &&
                displaySrc &&
                targetSize &&
                (() => {
                  const targetWidth = targetSize.width
                  const targetHeight = targetSize.height
                  const scaleFromOriginal = targetWidth / imageBounds.width

                  return (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="fixed inset-0 z-[9999] bg-black/90 select-none"
                        onClick={handleClose}
                        style={{ cursor: 'zoom-out' }}
                      />
                      <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none select-none">
                        <motion.div
                          initial={{
                            x: imageBounds.left + imageBounds.width / 2 - window.innerWidth / 2,
                            y: imageBounds.top + imageBounds.height / 2 - window.innerHeight / 2,
                            scale: 1 / scaleFromOriginal,
                          }}
                          animate={{
                            x: 0,
                            y: 0,
                            scale: userScale,
                            transition: {
                              duration: 0.4,
                              ease: [0.25, 0.1, 0.25, 1],
                            },
                          }}
                          exit={{
                            x: imageBounds.left + imageBounds.width / 2 - window.innerWidth / 2,
                            y: imageBounds.top + imageBounds.height / 2 - window.innerHeight / 2,
                            scale: 1 / scaleFromOriginal,
                            transition: {
                              duration: 0.35,
                              ease: [0.25, 0.1, 0.25, 1],
                            },
                          }}
                          style={{
                            width: targetWidth,
                            height: targetHeight,
                            pointerEvents: 'auto',
                            position: 'relative',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displaySrc}
                            alt={alt}
                            style={{
                              width: '100%',
                              height: '100%',
                              cursor: 'default',
                            }}
                            onClick={e => e.stopPropagation()}
                            ref={imageRef}
                          />
                          <AnimatePresence>
                            {isLoadingOriginal && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white/90 text-xs px-2.5 py-1.5 rounded-full pointer-events-none"
                              >
                                <Loader2 className="size-3 animate-spin" />
                                <span>{t('loadingHD')}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    </>
                  )
                })()}
            </AnimatePresence>,
            document.body,
          )}
      </>
    )
  },
)

ImageLightbox.displayName = 'ImageLightbox'

export { ImageLightbox }
