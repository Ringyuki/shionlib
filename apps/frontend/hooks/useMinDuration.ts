import { useCallback } from 'react'

export const useMinDuration = (defaultMinDurationMs = 500) => {
  const runWithMinDuration = useCallback(
    async <T>(task: () => Promise<T>, customMinDurationMs?: number) => {
      const startTime = Date.now()
      try {
        return await task()
      } finally {
        const minDurationMs = customMinDurationMs ?? defaultMinDurationMs
        const elapsed = Date.now() - startTime
        const remaining = minDurationMs - elapsed
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
      }
    },
    [defaultMinDurationMs],
  )

  return {
    runWithMinDuration,
  }
}
