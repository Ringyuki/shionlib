import { useEffect, useEffectEvent, useRef } from 'react'
import { href, useFetcher } from 'react-router'
import type { View } from './game.schema'
import type { countViewAction } from './game.server'

export function useViewCount(gameId: number) {
  const { submit } = useFetcher<typeof countViewAction>()
  const counted = useRef<number | undefined>(undefined)
  const count = useEffectEvent((view: View) => {
    void submit(view, {
      method: 'post',
      action: href('/resources/game/view'),
      encType: 'application/json',
      defaultShouldRevalidate: false,
    })
  })
  useEffect(() => {
    if (counted.current === gameId) {
      return
    }
    counted.current = gameId
    count({ gameId })
  }, [gameId])
}
