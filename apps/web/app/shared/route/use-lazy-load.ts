import { useEffect, useEffectEvent, useState } from 'react'
import type { FetcherWithComponents } from 'react-router'
import { useRefusalNotice, type Outcome } from './refusal'

export function useLazyLoad<Result>(fetcher: FetcherWithComponents<Outcome<Result>>) {
  const notify = useRefusalNotice()
  const outcome = fetcher.data
  const [kept, setKept] = useState<{ result: Result }>()
  if (outcome?.ok === true && kept?.result !== outcome.result) {
    setKept({ result: outcome.result })
  }
  const report = useEffectEvent((loaded: Outcome<Result>) => {
    if (!loaded.ok) {
      notify(loaded)
    }
  })
  useEffect(() => {
    if (outcome !== undefined) {
      report(outcome)
    }
  }, [outcome])
  return {
    load: fetcher.load,
    loading: fetcher.state !== 'idle',
    result: outcome?.ok === true ? outcome.result : kept?.result,
    failed: outcome?.ok === false,
  }
}
