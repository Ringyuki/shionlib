import { useEffect, useEffectEvent, useRef } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { View } from './game.schema'
import type { countViewAction } from './game.server'

export function useViewCount(gameId: number) {
  const { run } = useCommand(useFetcher<typeof countViewAction>(), href('/resources/game/view'), {
    revalidate: false,
    quiet: true,
  })
  const counted = useRef<number | undefined>(undefined)
  const count = useEffectEvent((view: View) => void run(view))
  useEffect(() => {
    if (counted.current === gameId) {
      return
    }
    counted.current = gameId
    count({ gameId })
  }, [gameId])
}
