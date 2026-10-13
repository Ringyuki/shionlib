import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import {
  blankParams,
  firstTarget,
  historyOf,
  maxTargets,
  type Choices,
  type Exchange,
  type Params,
  type Target,
} from './admin-ai-playground'
import type { PlaygroundRun } from './admin-ai-playground.schema'
import type { aiPlaygroundAction } from './admin-ai-playground.server'

function useRun() {
  return useCommand(
    useFetcher<typeof aiPlaygroundAction>(),
    href('/resources/admin/ai/playground'),
    { revalidate: false },
  )
}

type Lane = { target: Target; exchanges: Exchange[] }

export function usePlayground(choices: Choices) {
  const runs = [useRun(), useRun(), useRun()]
  const [lanes, setLanes] = useState<Lane[]>(() => {
    const first = firstTarget(choices)
    return first === undefined ? [] : [{ target: first, exchanges: [] }]
  })
  const [params, setParams] = useState<Params>(blankParams)
  const busy = runs.some(run => run.pending)
  const answer = (index: number, exchange: Exchange) =>
    setLanes(current =>
      current.map((lane, position) =>
        position === index
          ? { ...lane, exchanges: [...lane.exchanges.slice(0, -1), exchange] }
          : lane,
      ),
    )
  const send = (message: string) => {
    const sent = lanes.slice(0, maxTargets)
    setLanes(
      sent.map(lane => ({
        ...lane,
        exchanges: [...lane.exchanges, { message, reply: undefined }],
      })),
    )
    sent.forEach((lane, index) => {
      const run: PlaygroundRun = {
        target: lane.target,
        messages: historyOf(lane.exchanges, message),
        system: params.system,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        schema: params.structured ? params.schema : null,
      }
      void runs[index]?.run(run).then(outcome => {
        const reply = outcome.ok ? (outcome.result ?? undefined) : undefined
        if (reply === undefined) {
          setLanes(current =>
            current.map((kept, position) =>
              position === index ? { ...kept, exchanges: kept.exchanges.slice(0, -1) } : kept,
            ),
          )
          return
        }
        answer(index, { message, reply })
      })
    })
  }
  return {
    lanes,
    params,
    busy,
    pendingAt: (index: number) => runs[index]?.pending === true,
    setParams: (changes: Partial<Params>) => setParams(current => ({ ...current, ...changes })),
    retarget: (index: number, target: Target) =>
      setLanes(current =>
        current.map((lane, position) => (position === index ? { target, exchanges: [] } : lane)),
      ),
    add: () => {
      const next = firstTarget(
        choices,
        lanes.map(lane => lane.target),
      )
      if (next !== undefined && lanes.length < maxTargets) {
        setLanes([...lanes, { target: next, exchanges: [] }])
      }
    },
    remove: (index: number) => setLanes(lanes.filter((_, position) => position !== index)),
    restart: () => setLanes(lanes.map(lane => ({ ...lane, exchanges: [] }))),
    send,
  }
}

export type Playground = ReturnType<typeof usePlayground>
