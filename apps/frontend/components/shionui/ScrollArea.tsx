'use client'

import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

import { cn } from '@/utils/cn'

interface ScrollAreaProps extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  showScrollHint?: boolean
  scrollbarOrientation?: 'vertical' | 'horizontal' | 'both'
  showScrollbar?: boolean
}

const HOVER_DWELL_THRESHOLD = 150

function ScrollArea({
  className,
  children,
  showScrollHint = true,
  scrollbarOrientation = 'vertical',
  showScrollbar = true,
  ...props
}: ScrollAreaProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [canScrollUp, setCanScrollUp] = React.useState(false)
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const enterTimeRef = React.useRef(0)
  const isHoveringRef = React.useRef(false)

  const getScrollState = React.useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return null

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = viewport
    const maxScrollTop = scrollHeight - clientHeight
    const maxScrollLeft = scrollWidth - clientWidth

    return {
      hasOverflowY: scrollHeight > clientHeight + 1,
      hasOverflowX: scrollWidth > clientWidth + 1,
      canUp: scrollTop > 0,
      canDown: scrollTop < maxScrollTop - 1,
      canLeft: scrollLeft > 0,
      canRight: scrollLeft < maxScrollLeft - 1,
    }
  }, [])

  const updateScrollState = React.useCallback(() => {
    const state = getScrollState()
    if (!state) return

    setCanScrollUp(state.canUp)
    setCanScrollDown(state.canDown)
    setCanScrollLeft(state.canLeft)
    setCanScrollRight(state.canRight)
  }, [getScrollState])

  React.useEffect(() => {
    updateScrollState()
  }, [children, updateScrollState])

  React.useEffect(() => {
    updateScrollState()
    const viewport = viewportRef.current
    if (!viewport) return

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollState()) : null
    if (resizeObserver) {
      resizeObserver.observe(viewport)
    }

    const handleResize = () => updateScrollState()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [updateScrollState])

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const state = getScrollState()
      if (!state) return

      const isVertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX)
      const hasOverflow = isVertical ? state.hasOverflowY : state.hasOverflowX

      if (!hasOverflow) return

      if (isVertical) {
        if (e.deltaY > 0 && !state.canDown) return
        if (e.deltaY < 0 && !state.canUp) return
      } else {
        if (e.deltaX > 0 && !state.canRight) return
        if (e.deltaX < 0 && !state.canLeft) return
      }

      const dwellTime = Date.now() - enterTimeRef.current
      if (dwellTime < HOVER_DWELL_THRESHOLD) return

      e.stopPropagation()
    },
    [getScrollState],
  )

  const handlePointerEnter = React.useCallback(() => {
    enterTimeRef.current = Date.now()
    isHoveringRef.current = true
  }, [])

  const handlePointerLeave = React.useCallback(() => {
    isHoveringRef.current = false
  }, [])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative isolate rounded-[inherit] bg-transparent overflow-hidden', className)}
      suppressHydrationWarning
      onWheelCapture={handleWheel}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      <div
        data-slot="scroll-area-shadow-top"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-foreground/15 to-transparent transition-opacity',
          canScrollUp && showScrollHint ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-slot="scroll-area-shadow-bottom"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-foreground/15 to-transparent transition-opacity',
          canScrollDown && showScrollHint ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-slot="scroll-area-shadow-left"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-gradient-to-r from-foreground/15 to-transparent transition-opacity',
          canScrollLeft && showScrollHint ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-slot="scroll-area-shadow-right"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-3 bg-gradient-to-l from-foreground/15 to-transparent transition-opacity',
          canScrollRight && showScrollHint ? 'opacity-100' : 'opacity-0',
        )}
      />
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 h-full w-full max-h-[inherit] overflow-auto rounded-[inherit] bg-transparent transition-[color,box-shadow,background-color] outline-none focus-visible:ring-[3px] focus-visible:outline-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        ref={viewportRef}
        onScroll={updateScrollState}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(scrollbarOrientation === 'vertical' || scrollbarOrientation === 'both') && (
        <ScrollBar orientation="vertical" show={showScrollbar} />
      )}
      {(scrollbarOrientation === 'horizontal' || scrollbarOrientation === 'both') && (
        <ScrollBar orientation="horizontal" show={showScrollbar} />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  show = true,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & { show?: boolean }) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      forceMount
      orientation={orientation}
      className={cn(
        'group/scrollbar flex touch-none select-none p-[2px] transition-opacity duration-200 ease-out data-[state=visible]:opacity-100 data-[state=hidden]:opacity-0 data-[state=hidden]:pointer-events-none',
        orientation === 'vertical' && 'h-full w-3 border-l border-l-transparent pl-1',
        orientation === 'horizontal' && 'h-3 flex-col border-t border-t-transparent pt-1',
        !show && 'hidden',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          'relative flex-1 rounded-full bg-[rgba(0,0,0,0.44)] transition-[background-color,opacity,height,width] before:absolute before:inset-[-6px] before:rounded-full before:bg-transparent group-hover/scrollbar:bg-[rgba(0,0,0,0.55)] group-active/scrollbar:bg-[rgba(0,0,0,0.66)]',
          !show && '!opacity-0',
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
