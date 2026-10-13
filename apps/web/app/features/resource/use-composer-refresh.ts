import { useEffect } from 'react'
import { useRevalidator } from 'react-router'
import { composerRefreshEvery } from './resource-composition'

export function useComposerRefresh(active: boolean, every = composerRefreshEvery) {
  const { revalidate } = useRevalidator()
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void revalidate()
      }
    }, every)
    return () => window.clearInterval(timer)
  }, [active, every, revalidate])
}
