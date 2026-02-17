'use client'

import * as React from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useScrollLock } from '@/hooks/useScrollLock'

import { ImageLightboxGalleryContext, type LightboxGroupItem } from './ImageLightboxGalleryContext'
import { calculateTargetSize, loadImageDimensions, resolveOriginalSrc } from './utils/imageLightbox'
import { Button } from './Button'
import { isMobile } from './utils/imageLightbox'
import { useDisableZoom } from '@/hooks/useDisableZoom'
import { useRestoreBodyPointerEvents } from '@/hooks/useRestoreBodyPointerEvents'

interface ImageLightboxGalleryProps {
  children: React.ReactNode
}

type SlideDirection = 1 | -1 | 0

const slideVariants = {
  enter: ({ direction }: { direction: SlideDirection }) => ({
    x: direction === 0 ? 0 : direction * 80,
    opacity: direction === 0 ? 1 : 0,
    pointerEvents: 'none',
  }),
  center: {
    x: 0,
    opacity: 1,
    pointerEvents: 'auto',
  },
  exit: ({ direction }: { direction: SlideDirection }) => ({
    x: direction === 0 ? 0 : direction * -80,
    opacity: direction === 0 ? 1 : 0,
    pointerEvents: 'none',
  }),
}

const ImageLightboxGallery = ({ children }: ImageLightboxGalleryProps) => {
  const [items, setItems] = React.useState<LightboxGroupItem[]>([])
  const itemsRef = React.useRef(items)
  React.useEffect(() => {
    itemsRef.current = items
  }, [items])

  const [activeItemId, setActiveItemId] = React.useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = React.useState<number | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  const [shouldShow, setShouldShow] = React.useState(false)
  const [userScale, setUserScale] = React.useState(1)
  const [imageBounds, setImageBounds] = React.useState<DOMRect | null>(null)
  const [targetSize, setTargetSize] = React.useState<{ width: number; height: number } | null>(null)
  const [imageNaturalSize, setImageNaturalSize] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const [displaySrc, setDisplaySrc] = React.useState('')
  const [alt, setAlt] = React.useState('')
  const [navDirection, setNavDirection] = React.useState<SlideDirection>(0)
  const [mounted, setMounted] = React.useState(false)
  const [isLoadingOriginal, setIsLoadingOriginal] = React.useState(false)
  const loadIdRef = React.useRef(0)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const t = useTranslations('Components.ShionUI.ImageLightbox')

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const registerItem = React.useCallback((item: LightboxGroupItem) => {
    setItems(prev => {
      const index = prev.findIndex(entry => entry.id === item.id)
      if (index >= 0) {
        const next = [...prev]
        next[index] = item
        return next
      }
      return [...prev, item]
    })

    return () => {
      setItems(prev => prev.filter(entry => entry.id !== item.id))
    }
  }, [])

  const prepareImage = React.useCallback((item: LightboxGroupItem) => {
    const loadId = ++loadIdRef.current

    const imageElement = item.getImage()
    const bounds =
      imageElement?.getBoundingClientRect() ?? item.getContainer()?.getBoundingClientRect() ?? null

    const optimizedSrc = imageElement?.currentSrc || imageElement?.src || item.src

    const naturalWidth = imageElement?.naturalWidth || imageElement?.width || bounds?.width || 0
    const naturalHeight = imageElement?.naturalHeight || imageElement?.height || bounds?.height || 0

    if (bounds && naturalWidth && naturalHeight) {
      setImageBounds(bounds)
      setDisplaySrc(optimizedSrc)
      setAlt(item.alt ?? '')
      setImageNaturalSize({ width: naturalWidth, height: naturalHeight })
      setTargetSize(
        calculateTargetSize(naturalWidth, naturalHeight, item.lightboxMaxSize, item.maxWidth),
      )
    }

    // load original image in background
    const originalSrc = resolveOriginalSrc(item.src)
    if (originalSrc !== optimizedSrc) {
      setIsLoadingOriginal(true)
      loadImageDimensions(originalSrc)
        .then(dimensions => {
          if (loadId !== loadIdRef.current) return
          setImageNaturalSize({
            width: dimensions.width,
            height: dimensions.height,
          })
          setTargetSize(
            calculateTargetSize(
              dimensions.width,
              dimensions.height,
              item.lightboxMaxSize,
              item.maxWidth,
            ),
          )
          setDisplaySrc(originalSrc)
        })
        .catch(error => {
          console.warn('[ImageLightboxGallery] Failed to load original image', error)
        })
        .finally(() => {
          if (loadId === loadIdRef.current) {
            setIsLoadingOriginal(false)
          }
        })
    }
  }, [])

  const openItem = React.useCallback(
    (id: string) => {
      const index = itemsRef.current.findIndex(item => item.id === id)
      if (index === -1) return
      const item = itemsRef.current[index]
      setCurrentIndex(index)
      setActiveItemId(id)
      setIsOpen(true)
      setShouldShow(true)
      setNavDirection(0)
      setUserScale(1)
      void prepareImage(item)
    },
    [prepareImage],
  )

  const handleClose = React.useCallback(() => {
    setShouldShow(false)
    setUserScale(1)
    setNavDirection(0)
  }, [])

  const handleExitComplete = () => {
    setIsOpen(false)
    setActiveItemId(null)
    setCurrentIndex(null)
    setDisplaySrc('')
    setImageBounds(null)
    setTargetSize(null)
    setImageNaturalSize(null)
    setNavDirection(0)
  }

  const handleNavigate = React.useCallback(
    (direction: 1 | -1) => {
      if (currentIndex === null) return
      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= itemsRef.current.length) return
      const nextItem = itemsRef.current[nextIndex]
      setNavDirection(direction)
      setCurrentIndex(nextIndex)
      setActiveItemId(nextItem.id)
      setUserScale(1)
      void prepareImage(nextItem)
    },
    [currentIndex, prepareImage],
  )

  const handleDragEnd = React.useCallback(
    (_: MouseEvent | TouchEvent, info: PanInfo) => {
      if (userScale !== 1) return
      if (info.offset.x > 100) {
        handleNavigate(-1)
      } else if (info.offset.x < -100) {
        handleNavigate(1)
      }
    },
    [handleNavigate, userScale],
  )

  const handleKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNavigate(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleNavigate(-1)
      }
    },
    [handleClose, handleNavigate],
  )

  React.useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  useScrollLock(isOpen)
  useDisableZoom(isOpen)
  useRestoreBodyPointerEvents(isOpen)

  const canGoPrev = currentIndex !== null && currentIndex > 0
  const canGoNext = currentIndex !== null && currentIndex < items.length - 1
  const canSwipe = items.length > 1 && userScale === 1
  const activeImageKey = currentIndex !== null ? `image-${currentIndex}` : 'image-inactive'

  const contextValue = React.useMemo(
    () => ({
      registerItem,
      openItem,
      activeItemId,
    }),
    [registerItem, openItem, activeItemId],
  )

  const scaleFromOriginal =
    imageBounds && targetSize && imageBounds.width !== 0 ? targetSize.width / imageBounds.width : 1

  const originX =
    imageBounds && typeof window !== 'undefined'
      ? imageBounds.left + imageBounds.width / 2 - window.innerWidth / 2
      : 0
  const originY =
    imageBounds && typeof window !== 'undefined'
      ? imageBounds.top + imageBounds.height / 2 - window.innerHeight / 2
      : 0

  return (
    <ImageLightboxGalleryContext.Provider value={contextValue}>
      {children}
      {mounted &&
        createPortal(
          <>
            <AnimatePresence onExitComplete={handleExitComplete}>
              {shouldShow && imageBounds && imageNaturalSize && displaySrc && targetSize && (
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
                        x: originX,
                        y: originY,
                        scale: 1 / scaleFromOriginal,
                      }}
                      animate={{
                        x: 0,
                        y: 0,
                        scale: 1,
                        transition: {
                          duration: 0.4,
                          ease: [0.25, 0.1, 0.25, 1],
                        },
                      }}
                      exit={{
                        x: originX,
                        y: originY,
                        scale: 1 / scaleFromOriginal,
                        transition: {
                          duration: 0.35,
                          ease: [0.25, 0.1, 0.25, 1],
                        },
                      }}
                      style={{
                        width: targetSize.width,
                        height: targetSize.height,
                        pointerEvents: 'auto',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <AnimatePresence initial={false} custom={{ direction: navDirection }}>
                        <motion.img
                          key={activeImageKey}
                          ref={imageRef}
                          src={displaySrc}
                          alt={alt}
                          custom={{ direction: navDirection }}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            duration: 0.35,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          drag={canSwipe ? 'x' : undefined}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.2}
                          dragMomentum={false}
                          onDragEnd={handleDragEnd}
                          style={{
                            width: '100%',
                            height: '100%',
                            cursor: canSwipe ? 'grab' : 'default',
                            userSelect: 'none',
                            touchAction: 'none',
                            scale: userScale,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            transformOrigin: 'center',
                          }}
                          onClick={event => event.stopPropagation()}
                        />
                      </AnimatePresence>
                      <AnimatePresence>
                        {isLoadingOriginal && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 text-white/90 text-xs px-2.5 py-1.5 rounded-full pointer-events-none"
                          >
                            <Loader2 className="size-3 animate-spin" />
                            <span>{t('loadingHD')}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </>
              )}
            </AnimatePresence>

            {items.length > 1 && isOpen && (
              <AnimatePresence>
                {shouldShow && !isMobile() && (
                  <motion.div
                    key="prev-button"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                    className="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 z-[10001] pointer-events-auto"
                  >
                    <Button
                      type="button"
                      size="icon"
                      renderIcon={<ChevronLeft className="size-5" />}
                      intent="secondary"
                      appearance="ghost"
                      className="text-white/80 hover:bg-black/70 active:bg-black/80"
                      disabled={!canGoPrev}
                      onClick={() => handleNavigate(-1)}
                    />
                  </motion.div>
                )}

                {shouldShow && !isMobile() && (
                  <motion.div
                    key="next-button"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                    className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[10001] pointer-events-auto"
                  >
                    <Button
                      type="button"
                      size="icon"
                      renderIcon={<ChevronRight className="size-5" />}
                      intent="secondary"
                      appearance="ghost"
                      className="text-white/80 hover:bg-black/70 active:bg-black/80"
                      disabled={!canGoNext}
                      onClick={() => handleNavigate(1)}
                    />
                  </motion.div>
                )}

                {shouldShow && (
                  <motion.div
                    key="counter"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/60 px-3 py-1.5 rounded-full pointer-events-none z-[10001]"
                  >
                    {currentIndex !== null ? currentIndex + 1 : 0} / {items.length}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>,
          document.body,
        )}
    </ImageLightboxGalleryContext.Provider>
  )
}

export { ImageLightboxGallery }
