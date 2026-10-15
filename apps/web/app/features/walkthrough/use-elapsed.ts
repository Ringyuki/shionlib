import { useEffect, useState } from 'react'

export function useElapsed(since: number | undefined): number {
  const [now, setNow] = useState(since)
  useEffect(() => {
    if (since === undefined) {
      return undefined
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [since])
  return since === undefined || now === undefined ? 0 : Math.max(0, now - since)
}
