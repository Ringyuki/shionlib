'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { Button as ShionButton } from '@/components/shionui/Button'
import { cn } from '@/utils/cn'
import { useControlledState } from '@/components/shionui/animated/hooks/use-controlled-state'

type CopyButtonVariant =
  | 'default'
  | 'accent'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'

type CopyButtonSize = 'default' | 'xs' | 'sm' | 'lg'

type ShionBtnProps = React.ComponentProps<typeof ShionButton>

type CopyButtonProps = Omit<ShionBtnProps, 'children' | 'size' | 'intent' | 'appearance'> & {
  variant?: CopyButtonVariant
  size?: CopyButtonSize
  content: string
  copied?: boolean
  onCopiedChange?: (copied: boolean, content?: string) => void
  delay?: number
}

function CopyButton({
  className,
  content,
  copied,
  onCopiedChange,
  onClick,
  variant,
  size,
  delay = 3000,
  ...props
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useControlledState({
    value: copied,
    onChange: onCopiedChange,
  })

  const mapVariantToShion = React.useCallback(
    (
      v: NonNullable<CopyButtonVariant>,
    ): { intent: ShionBtnProps['intent']; appearance: ShionBtnProps['appearance'] } => {
      switch (v) {
        case 'default':
          return { intent: 'primary', appearance: 'solid' }
        case 'accent':
          return { intent: 'secondary', appearance: 'solid' }
        case 'destructive':
          return { intent: 'destructive', appearance: 'solid' }
        case 'outline':
          return { intent: 'neutral', appearance: 'outline' }
        case 'secondary':
          return { intent: 'secondary', appearance: 'solid' }
        case 'ghost':
          return { intent: 'neutral', appearance: 'ghost' }
        case 'link':
          return { intent: 'primary', appearance: 'link' }
        default:
          return { intent: 'primary', appearance: 'solid' }
      }
    },
    [],
  )

  const sizeOverrideClass = React.useMemo(() => {
    switch (size) {
      case 'xs':
        return "size-6 [&_svg:not([class*='size-'])]:size-3 rounded-md"
      case 'sm':
        return "size-8 [&_svg:not([class*='size-'])]:size-4 rounded-md"
      case 'lg':
        return "size-10 [&_svg:not([class*='size-'])]:size-5 rounded-md"
      case 'default':
      default:
        return 'size-9'
    }
  }, [size])

  const handleCopy = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (copied) return
      if (content) {
        navigator.clipboard
          .writeText(content)
          .then(() => {
            setIsCopied(true)
            onCopiedChange?.(true, content)
            setTimeout(() => {
              setIsCopied(false)
              onCopiedChange?.(false)
            }, delay)
          })
          .catch(error => {
            console.error('Error copying command', error)
          })
      }
    },
    [onClick, copied, content, setIsCopied, onCopiedChange, delay],
  )

  const Icon = isCopied ? CheckIcon : CopyIcon

  return (
    <ShionButton
      data-slot="copy-button"
      className={cn(sizeOverrideClass, className)}
      {...mapVariantToShion(variant ?? 'default')}
      size="icon"
      onClick={handleCopy}
      {...props}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={isCopied ? 'check' : 'copy'}
          data-slot="copy-button-icon"
          initial={{ scale: 0, opacity: 0.4, filter: 'blur(4px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0, opacity: 0.4, filter: 'blur(4px)' }}
          transition={{ duration: 0.25 }}
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </ShionButton>
  )
}

export { CopyButton, type CopyButtonProps }
