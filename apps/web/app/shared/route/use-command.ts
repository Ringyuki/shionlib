import { useEffect, useEffectEvent, useRef } from 'react'
import type { FetcherWithComponents, SubmitTarget } from 'react-router'
import { Refusal, useRefusalNotice, type Outcome } from './refusal'

type CommandOptions = {
  revalidate?: boolean
  quiet?: boolean
}

export function useCommand<Result>(
  fetcher: FetcherWithComponents<Outcome<Result>>,
  action?: string,
  { revalidate = true, quiet = false }: CommandOptions = {},
) {
  const notify = useRefusalNotice()
  const waiting = useRef<((outcome: Outcome<Result>) => void) | undefined>(undefined)
  const outcome = fetcher.state === 'submitting' ? undefined : fetcher.data
  const settle = useEffectEvent((settled: Outcome<Result>) => {
    if (!settled.ok && !quiet) {
      notify(settled)
    }
    const resolve = waiting.current
    waiting.current = undefined
    resolve?.(settled)
  })
  useEffect(() => {
    if (outcome !== undefined) {
      settle(outcome)
    }
  }, [outcome])
  const run = (payload: SubmitTarget) =>
    new Promise<Outcome<Result>>(resolve => {
      waiting.current = resolve
      void fetcher.submit(payload, {
        method: 'post',
        action,
        encType: 'application/json',
        defaultShouldRevalidate: revalidate,
      })
    })
  const confirm = async (payload: SubmitTarget) => {
    const settled = await run(payload)
    if (!settled.ok) {
      throw new Refusal(settled.failure)
    }
    return settled.result
  }
  return {
    run,
    confirm,
    pending: fetcher.state !== 'idle',
    settled: outcome,
    failure: outcome?.ok === false ? outcome.failure : undefined,
    payload: fetcher.json,
  }
}
