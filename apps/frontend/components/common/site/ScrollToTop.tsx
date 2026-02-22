'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/shionui/Button'

const SCROLL_THRESHOLD = 300

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      const isScrollingUp = currentY < lastScrollY.current
      lastScrollY.current = currentY
      setVisible(currentY > SCROLL_THRESHOLD && isScrollingUp)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
