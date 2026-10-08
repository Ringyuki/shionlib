import { useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import { nameCheckDelay } from './settings'
import type { nameAction, nameCheckAction } from './settings.server'

export function useRename(current: string) {
  const [name, setName] = useState(current)
  const rename = useCommand(useFetcher<typeof nameAction>(), href('/resources/settings/name'))
  const check = useCommand(
    useFetcher<typeof nameCheckAction>(),
    href('/resources/settings/name-check'),
    { quiet: true, revalidate: false },
  )
  const [checked, setChecked] = useState<{ name: string; taken: boolean }>()
  const wanted = name.trim()
  const ask = useEffectEvent(async (candidate: string) => {
    const outcome = await check.run({ name: candidate })
    if (outcome.ok) {
      setChecked({ name: candidate, taken: outcome.result })
    }
  })
  useEffect(() => {
    if (wanted === '' || wanted === current) {
      return
    }
    const timer = window.setTimeout(() => void ask(wanted), nameCheckDelay)
    return () => window.clearTimeout(timer)
  }, [wanted, current])
  const verdict = checked?.name === wanted && wanted !== current ? checked.taken : undefined
  return {
    name,
    setName,
    changed: wanted !== current,
    taken: verdict === true,
    available: verdict === false,
    failure: rename.failure,
    pending: rename.pending,
    save: () => rename.run({ name: wanted }),
  }
}
