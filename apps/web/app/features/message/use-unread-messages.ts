import { useEffect, useEffectEvent, useState } from 'react'
import { useLocation, useRevalidator } from 'react-router'
import { useLocale } from 'use-intl'
import { followEvents } from '~/shared/api/event-stream'
import { atInbox, newMessageEvent, streamPath, unreadEvent, unreadPath } from './message'
import { unreadFrom } from './message.schema'

export function useUnreadMessages(loaded: number, signedIn: boolean): number {
  const locale = useLocale()
  const { pathname } = useLocation()
  const revalidator = useRevalidator()
  const [live, setLive] = useState<number>()
  const [seen, setSeen] = useState(loaded)
  if (seen !== loaded) {
    setSeen(loaded)
    setLive(undefined)
  }
  const arrived = useEffectEvent(() => {
    if (atInbox(pathname, locale) && revalidator.state === 'idle') {
      void revalidator.revalidate()
    }
  })
  useEffect(() => {
    if (!signedIn) {
      return
    }
    return followEvents(
      streamPath,
      {
        [unreadEvent]: data => setLive(unreadFrom(data)),
        [newMessageEvent]: () => arrived(),
      },
      { probe: unreadPath },
    )
  }, [signedIn])
  return signedIn ? (live ?? loaded) : 0
}
