import { useMemo, useSyncExternalStore } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { startedFor, startedKey, type Order, type Started } from './sponsor'
import { startedFrom } from './sponsor.schema'
import type { payAction } from './sponsor.server'

const changed = 'shionlib:sponsor-payment'

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changed, notify)
  }
}

const stored = () => readLocal(startedKey, value => value)

const nothingStored = () => null

function keep(started: Started | null) {
  writeLocal(startedKey, started)
  window.dispatchEvent(new Event(changed))
}

export function usePayment(order: Pick<Order, 'id' | 'status'>) {
  const raw = useSyncExternalStore(subscribe, stored, nothingStored)
  const { id, status } = order
  const started = useMemo(() => startedFor(startedFrom(raw), { id, status }), [raw, id, status])
  const command = useCommand(useFetcher<typeof payAction>(), href('/resources/sponsor/payments'), {
    revalidate: false,
  })
  const start = async (method: string, opens: boolean) => {
    const tab = opens ? window.open('', '_blank') : null
    const outcome = await command.run({ id, method, back: window.location.href })
    if (!outcome.ok) {
      tab?.close()
      return
    }
    keep({ order: id, method, ...outcome.result })
    if (tab !== null) {
      tab.opener = null
      tab.location.replace(outcome.result.payUrl)
    }
  }
  return { started, start, change: () => keep(null), pending: command.pending }
}
