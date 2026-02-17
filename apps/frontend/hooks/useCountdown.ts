import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCountdownOptions {
  duration?: number
  intervalMs?: number
}

interface UseCountdownReturn {
  countdown: number
  isCountingDown: boolean
  startCountdown: (customDuration?: number) => void
  resetCountdown: () => void
}

export const useCountdown = (options: UseCountdownOptions = {}): UseCountdownReturn => {
  const { duration = 60, intervalMs = 1000 } = options
  const [countdown, setCountdown] = useState(0)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetCountdown = useCallback(() => {
    clearTimer()
    setCountdown(0)
    setIsCountingDown(false)
  }, [clearTimer])

  const startCountdown = useCallback(
    (customDuration?: number) => {
      if (isCountingDown) {
        return
      }
      const nextDuration = customDuration ?? duration
      if (nextDuration <= 0) {
        return
      }
      setCountdown(nextDuration)
      setIsCountingDown(true)
    },
    [duration, isCountingDown],
  )

  useEffect(() => {
    if (!isCountingDown) {
      return
    }

    clearTimer()
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearTimer()
          setIsCountingDown(false)
          return 0
        }
        return prev - 1
      })
    }, intervalMs)

    return () => {
      clearTimer()
    }
  }, [clearTimer, intervalMs, isCountingDown])

  useEffect(
    () => () => {
      clearTimer()
    },
    [clearTimer],
  )

  return {
    countdown,
    isCountingDown,
    startCountdown,
    resetCountdown,
  }
}
