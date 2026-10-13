import { useEffect } from 'react'
import { useRevalidator } from 'react-router'
import { refreshEvery } from './uploader'

export function useLiveRefresh(active: boolean) {
  const { revalidate } = useRevalidator()
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void revalidate()
      }
    }, refreshEvery)
    return () => window.clearInterval(timer)
  }, [active, revalidate])
}
