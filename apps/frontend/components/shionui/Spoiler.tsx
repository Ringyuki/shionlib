'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'
import { Hidden } from '@/components/common/content/Hidden'

type SpoilerProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  blur?: number
  showHint?: boolean
  hintText?: string
  showHidden?: boolean
}

function Spoiler({
  children,
  className,
  defaultOpen = false,
  open,
  onOpenChange,
  blur = 10,
  showHint = false,
  hintText,
  showHidden = true,
  ...props
}: SpoilerProps) {
  const t = useTranslations('Components.ShionUI.Spoiler')
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen)
  const actualOpen = isControlled ? (open as boolean) : internalOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const handleReveal = () => setOpen(true)

  return (
    <div className={cn('relative overflow-hidden h-full rounded-md', className)} {...props}>
      <motion.div
        className={cn('h-full', className)}
        data-slot="spoiler-content"
        initial={false}
        animate={{ filter: actualOpen ? 'blur(0px)' : `blur(${blur}px)` }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {!actualOpen && (
          <motion.div
            role="button"
            aria-label={t('hintText')}
            tabIndex={0}
            onClick={handleReveal}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleReveal()
              }
            }}
            className="absolute inset-0 cursor-pointer outline-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            {(showHint || showHidden) && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 pointer-events-none">
                {showHidden && (
                  <Hidden
                    vertical={true}
                    className="w-fit h-fit"
                    iconClassName="size-6"
                    showText={false}
                  />
                )}
                {showHint && (
                  <motion.div
                    className="rounded-md bg-background/70 px-3 py-1 text-sm text-foreground shadow"
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    {hintText || t('hintText')}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { Spoiler, type SpoilerProps }
