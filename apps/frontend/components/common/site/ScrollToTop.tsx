'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/shionui/Button'

const SCROLL_THRESHOLD = 300
export type ScrollToTopDisplayMode = 'auto' | 'show' | 'hide'

interface ScrollToTopContextValue {
  displayMode: ScrollToTopDisplayMode
  setDisplayMode: (mode: ScrollToTopDisplayMode) => void
  show: () => void
  hide: () => void
  reset: () => void
}

const ScrollToTopContext = createContext<ScrollToTopContextValue | null>(null)

export function ScrollToTopProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<ScrollToTopDisplayMode>('auto')

  return (
    <ScrollToTopContext.Provider
      value={{
        displayMode,
        setDisplayMode,
        show: () => setDisplayMode('show'),
        hide: () => setDisplayMode('hide'),
        reset: () => setDisplayMode('auto'),
      }}
    >
      {children}
    </ScrollToTopContext.Provider>
  )
}

export function useScrollToTopControl() {
  const context = useContext(ScrollToTopContext)
  if (!context) {
    throw new Error('useScrollToTopControl must be used within ScrollToTopProvider')
  }
  return context
}

export function ScrollToTop() {
  const context = useContext(ScrollToTopContext)
  const [autoVisible, setAutoVisible] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      const isScrollingUp = currentY < lastScrollY.current
      lastScrollY.current = currentY
      setAutoVisible(currentY > SCROLL_THRESHOLD && isScrollingUp)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const visible =
    context?.displayMode === 'show' || (context?.displayMode !== 'hide' && autoVisible)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            size="icon"
            appearance="solid"
            className="shadow-lg rounded-full p-5 size-12"
            aria-label="Scroll to top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            renderIcon={<ArrowUp className="size-5" />}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
