'use client'

import { Ad } from '@/interfaces/site/ad.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalImageUrl, needShowAd } from './helpers/ad'
import { SupportedLocales } from '@/config/i18n/supported'
import { useAdFreeDialogStore } from '@/store/adFreeDialogStore'
import { X } from 'lucide-react'
import { motion, type Transition } from 'motion/react'
import { useEffect, useLayoutEffect, useState, useRef } from 'react'

const badgeWidthTransition: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 42,
  mass: 0.75,
}

const badgeContentTransition: Transition = {
  duration: 0.18,
  ease: [0.2, 0, 0, 1],
}

const noTransition: Transition = { duration: 0 }

export const AdItem = ({ ad }: { ad: Ad }) => {
  const t = useTranslations('Components.Common.Site.Ad')
  const locale = useLocale() as SupportedLocales
  const { openAdFreeDialog } = useAdFreeDialogStore()
  const [showHideAdAction, setShowHideAdAction] = useState(false)
  const adLabel = t('ad')
  const hideAdLabel = t('hide-ad')
  const collapsedMeasureRef = useRef<HTMLSpanElement>(null)
  const expandedMeasureRef = useRef<HTMLSpanElement>(null)
  const [badgeWidth, setBadgeWidth] = useState({
    collapsed: 0,
    expanded: 0,
  })
  const [isBadgeMeasured, setIsBadgeMeasured] = useState(false)
  const [canAnimateBadgeWidth, setCanAnimateBadgeWidth] = useState(false)

  useLayoutEffect(() => {
    const updateBadgeWidth = () => {
      const collapsed = collapsedMeasureRef.current?.offsetWidth ?? 0
      const expanded = expandedMeasureRef.current?.offsetWidth ?? 0

      if (collapsed > 0 && expanded > 0) {
        setIsBadgeMeasured(true)
      }

      setBadgeWidth(prev => {
        if (prev.collapsed === collapsed && prev.expanded === expanded) {
          return prev
        }

        return { collapsed, expanded }
      })
    }

    updateBadgeWidth()

    if (
      !collapsedMeasureRef.current ||
      !expandedMeasureRef.current ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined
    }

    const observer = new ResizeObserver(updateBadgeWidth)
    observer.observe(collapsedMeasureRef.current)
    observer.observe(expandedMeasureRef.current)

    return () => observer.disconnect()
  }, [adLabel, hideAdLabel])

  useEffect(() => {
    if (!isBadgeMeasured) return undefined

    const frame = requestAnimationFrame(() => setCanAnimateBadgeWidth(true))

    return () => cancelAnimationFrame(frame)
  }, [isBadgeMeasured])

  if (!needShowAd(locale, [ad])) return null

  const image = getLocalImageUrl(locale, ad)
  const currentBadgeWidth = isBadgeMeasured
    ? badgeWidth[showHideAdAction ? 'expanded' : 'collapsed']
    : undefined

  return (
    <div
      className="w-full relative"
      onMouseEnter={() => setShowHideAdAction(true)}
      onMouseLeave={() => setShowHideAdAction(false)}
      onFocusCapture={() => setShowHideAdAction(true)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setShowHideAdAction(false)
        }
      }}
    >
      <Link
        href={ad.link}
        target="_blank"
        className={cn(
          'w-full h-auto hover:opacity-80 transition-opacity duration-200',
          'rounded-md overflow-hidden bg-card-soft relative block',
        )}
        style={{ aspectRatio: ad.aspect }}
      >
        <FadeImage src={image} alt={ad.id.toString()} fill={true} sizes="100vw" />
      </Link>
      <motion.button
        type="button"
        initial={false}
        animate={{
          width: currentBadgeWidth,
          backgroundColor: showHideAdAction ? 'rgba(0, 0, 0, 0.68)' : 'rgba(0, 0, 0, 0.5)',
        }}
        transition={{
          width: canAnimateBadgeWidth ? badgeWidthTransition : noTransition,
          backgroundColor: badgeContentTransition,
        }}
        aria-label={hideAdLabel}
        title={hideAdLabel}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          openAdFreeDialog()
        }}
        className={cn(
          'absolute right-2 top-2 z-10 flex h-6 min-w-7 origin-right items-center justify-center overflow-hidden whitespace-nowrap',
          'rounded-md text-white text-xs cursor-pointer shadow-sm will-change-[width] md:h-7 md:min-w-9 md:text-sm',
        )}
      >
        <span
          ref={collapsedMeasureRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 flex h-6 w-max items-center justify-center px-1.5 opacity-0 md:h-7 md:px-2"
        >
          {adLabel}
        </span>
        <span
          ref={expandedMeasureRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 flex h-6 w-max items-center justify-center gap-1 px-1.5 opacity-0 md:h-7 md:px-2"
        >
          <X className="size-3 shrink-0" />
          <span>{hideAdLabel}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex h-6 items-center justify-center px-1.5 opacity-0 md:h-7 md:px-2',
            showHideAdAction && 'gap-1',
            isBadgeMeasured && 'absolute left-0 top-0',
          )}
        >
          {showHideAdAction ? (
            <>
              <X className="size-3 shrink-0" />
              <span>{hideAdLabel}</span>
            </>
          ) : (
            adLabel
          )}
        </span>
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{
            opacity: showHideAdAction ? 0 : 1,
            x: showHideAdAction ? -4 : 0,
            filter: showHideAdAction ? 'blur(3px)' : 'blur(0px)',
          }}
          transition={badgeContentTransition}
          className="absolute inset-0 flex items-center justify-center px-1.5 will-change-[opacity,transform] md:px-2"
        >
          {adLabel}
        </motion.span>
        <motion.span
          initial={false}
          animate={{
            opacity: showHideAdAction ? 1 : 0,
            x: showHideAdAction ? 0 : 7,
            filter: showHideAdAction ? 'blur(0px)' : 'blur(3px)',
          }}
          transition={{
            ...badgeContentTransition,
            delay: showHideAdAction ? 0.04 : 0,
          }}
          className="absolute inset-0 flex items-center justify-center gap-1 px-1.5 will-change-[opacity,transform] md:px-2"
        >
          <X className="size-3 shrink-0" />
          <motion.span
            initial={false}
            animate={{ opacity: showHideAdAction ? 1 : 0 }}
            transition={{
              duration: 0.16,
              delay: showHideAdAction ? 0.08 : 0,
              ease: [0.2, 0, 0, 1],
            }}
          >
            {hideAdLabel}
          </motion.span>
        </motion.span>
      </motion.button>
    </div>
  )
}

export const AdList = ({ ads }: { ads: Ad[] }) => {
  const locale = useLocale() as SupportedLocales
  if (!needShowAd(locale, ads)) return null

  return (
    <div className="flex flex-col gap-4">
      {ads.map(ad => (
        <AdItem key={ad.id} ad={ad} />
      ))}
    </div>
  )
}
