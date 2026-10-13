import { useEffect } from 'react'
import { useRevalidator } from 'react-router'

export function useOrderWatch(every: number | undefined) {
  const { revalidate } = useRevalidator()
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        void revalidate()
      }
    }
    const timer = every === undefined ? undefined : window.setInterval(check, every)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [every, revalidate])
}
