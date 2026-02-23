import { useCallback } from 'react'

export function useIsAutomatingBrowser() {
  return useCallback(() => {
    try {
      return typeof navigator !== 'undefined' && navigator.webdriver === true
    } catch {
      return false
    }
  }, [])
}
