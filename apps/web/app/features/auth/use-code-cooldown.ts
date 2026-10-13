import { useEffect, useState } from 'react'
import { remainingSeconds } from './auth'

export function useCodeCooldown() {
  const [sentAt, setSentAt] = useState<number>()
  const [now, setNow] = useState(() => Date.now())
  const cooldown = remainingSeconds(sentAt, now)
  const counting = cooldown > 0

  useEffect(() => {
    if (!counting) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [counting])

  const start = () => {
    const at = Date.now()
    setSentAt(at)
    setNow(at)
  }

  return { cooldown, start }
}
