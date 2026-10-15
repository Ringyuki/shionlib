import { useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { walkthroughFormatAction, walkthroughFormatLoader } from './walkthrough.server'
import { pollEvery, type Formatted } from './walkthrough-format'

type FormatEvents = {
  onDone: (formatted: Formatted) => void
  onFailed: () => void
}

const endpoint = href('/resources/walkthroughs/format')

export function useWalkthroughFormat(
  gameId: number,
  task: string | undefined,
  { onDone, onFailed }: FormatEvents,
) {
  const start = useCommand(useFetcher<typeof walkthroughFormatAction>(), endpoint, {
    revalidate: false,
  })
  const poll = useLazyLoad(useFetcher<typeof walkthroughFormatLoader>())
  const [asked, setAsked] = useState<string>()
  const ask = useEffectEvent(() => {
    if (task !== undefined && !poll.loading) {
      setAsked(task)
      void poll.load(`${endpoint}?${new URLSearchParams({ task })}`)
    }
  })
  useEffect(() => {
    if (task === undefined) {
      return undefined
    }
    const timer = window.setInterval(ask, pollEvery)
    return () => window.clearInterval(timer)
  }, [task])
  const settled = task !== undefined && asked === task && !poll.loading
  const failed = settled && poll.failed
  const found = settled && !poll.failed && poll.result?.id === task ? poll.result.result : null
  const done = useEffectEvent(onDone)
  const fail = useEffectEvent(onFailed)
  useEffect(() => {
    if (found !== null) {
      done(found)
    }
  }, [found])
  useEffect(() => {
    if (failed) {
      fail()
    }
  }, [failed])
  return {
    failure: start.failure,
    begin: (text: string) => start.run({ gameId, text }),
  }
}
