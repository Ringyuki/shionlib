'use client'

import 'overlayscrollbars/overlayscrollbars.css'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import {
  OverlayScrollbars,
  type EventListeners,
  type OverlayScrollbars as OverlayScrollbarsInstance,
  type PartialOptions,
} from 'overlayscrollbars'

import { useComposedRefs } from '@/components/shionui/libs/compose-refs'
import { cn } from '@/utils/cn'

type ScrollBarElement = React.ElementRef<'div'>

export interface ScrollBarProps extends React.ComponentPropsWithoutRef<'div'> {
  asChild?: boolean
  options?: PartialOptions
  events?: EventListeners
  disabled?: boolean
  onInstanceChange?: (instance: OverlayScrollbarsInstance | null) => void
}

const BASE_OPTIONS: PartialOptions = {
  scrollbars: {
    theme: 'os-theme-dark',
    autoHide: 'move',
    autoHideDelay: 400,
    dragScroll: true,
    clickScroll: true,
  },
  overflow: {
    x: 'hidden',
    y: 'scroll',
  },
}

const ScrollBar = React.forwardRef<ScrollBarElement, ScrollBarProps>(
  (
    {
      asChild = false,
      options,
      events,
      disabled = false,
      className,
      children,
      onInstanceChange,
      ...props
    },
    forwardedRef,
  ) => {
    const Component = asChild ? Slot : 'div'
    const hostRef = React.useRef<ScrollBarElement | null>(null)
    const instanceRef = React.useRef<OverlayScrollbarsInstance | null>(null)
    const eventsCleanupRef = React.useRef<(() => void) | null>(null)
    const optionsRef = React.useRef<PartialOptions>(BASE_OPTIONS)
    const latestInstanceCallbackRef = React.useRef<ScrollBarProps['onInstanceChange'] | undefined>(
      undefined,
    )
    const mergedOptions = React.useMemo<PartialOptions>(() => {
      const baseScrollbars = BASE_OPTIONS.scrollbars ?? {}
      return {
        ...BASE_OPTIONS,
        ...options,
        scrollbars: {
          ...baseScrollbars,
          ...options?.scrollbars,
        },
      }
    }, [options])

    latestInstanceCallbackRef.current = onInstanceChange
    optionsRef.current = mergedOptions

    const destroyInstance = React.useCallback(() => {
      if (eventsCleanupRef.current) {
        eventsCleanupRef.current()
        eventsCleanupRef.current = null
      }

      if (instanceRef.current) {
        instanceRef.current.destroy()
        latestInstanceCallbackRef.current?.(null)
        instanceRef.current = null
      }
    }, [])

    const composedRef = useComposedRefs(hostRef, forwardedRef)

    React.useEffect(() => {
      if (!instanceRef.current || disabled) {
        return
      }

      instanceRef.current.options(mergedOptions)
    }, [mergedOptions, disabled])

    React.useEffect(() => {
      if (eventsCleanupRef.current) {
        eventsCleanupRef.current()
        eventsCleanupRef.current = null
      }

      if (!instanceRef.current || disabled || !events) {
        return
      }

      const remove = instanceRef.current.on(events)
      eventsCleanupRef.current = remove

      return () => {
        if (eventsCleanupRef.current === remove) {
          eventsCleanupRef.current = null
        }
        remove?.()
      }
    }, [events, disabled])

    React.useEffect(() => {
      if (disabled) {
        destroyInstance()
      } else {
        const target = hostRef.current

        if (target && !instanceRef.current) {
          const instance = OverlayScrollbars(target, optionsRef.current)
          instanceRef.current = instance
          latestInstanceCallbackRef.current?.(instance)
        }
      }

      return () => {
        destroyInstance()
      }
    }, [destroyInstance, disabled])

    return (
      <Component
        ref={composedRef}
        data-slot="scrollbar"
        data-disabled={disabled ? '' : undefined}
        className={cn(
          'relative block max-h-full w-full overflow-auto rounded-[inherit] transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    )
  },
)

ScrollBar.displayName = 'ScrollBar'

export { ScrollBar }
