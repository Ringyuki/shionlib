'use client'

import * as React from 'react'
import { motion, type Transition } from 'motion/react'

import { cn } from '@/utils/cn'

type GradientTextProps = React.ComponentProps<'span'> & {
  text: string | React.ReactNode
  gradient?: string
  neon?: boolean
  transition?: Transition
  textClassName?: string
}

function GradientText({
  text,
  className,
  gradient = 'linear-gradient(90deg, #3b82f6 0%, #a855f7 20%, #ec4899 50%, #a855f7 80%, #3b82f6 100%)',
  neon = false,
  transition = { duration: 3, repeat: Infinity, ease: 'linear' },
  textClassName,
  ...props
}: GradientTextProps) {
  const baseStyle: React.CSSProperties = {
    backgroundImage: gradient,
  }

  return (
    <span data-slot="gradient-text" className={cn('relative inline-block', className)} {...props}>
      <motion.span
        className={cn('m-0 text-transparent bg-clip-text bg-[length:200%_100%]', textClassName)}
        style={baseStyle}
        animate={{ backgroundPositionX: ['0%', '200%'] }}
        transition={transition}
      >
        {text}
      </motion.span>

      {neon && (
        <motion.span
          className="m-0 absolute top-0 left-0 text-transparent bg-clip-text blur-[8px] mix-blend-plus-lighter bg-[length:200%_100%]"
          style={baseStyle}
          animate={{ backgroundPositionX: ['0%', '200%'] }}
          transition={transition}
        >
          {text}
        </motion.span>
      )}
    </span>
  )
}

export { GradientText, type GradientTextProps }
