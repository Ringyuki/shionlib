import { useState } from 'react'
import { href, useFetcher, useNavigate } from 'react-router'
import type { Locale } from '~/shared/i18n/locale'
import { useCommand } from '~/shared/route/use-command'
import { sponsorPaths } from './sponsor'
import type { OrderDraft } from './sponsor.schema'
import type { orderCreationAction } from './sponsor.server'

export function useOrderCreation(locale: Locale, guest: boolean) {
  const navigate = useNavigate()
  const command = useCommand(
    useFetcher<typeof orderCreationAction>(),
    href('/resources/sponsor/orders'),
    { revalidate: false },
  )
  const [leaving, setLeaving] = useState(false)
  const run = async (draft: OrderDraft) => {
    const outcome = await command.run(draft)
    if (outcome.ok) {
      const { id, token } = outcome.result
      setLeaving(true)
      await navigate(sponsorPaths(locale).order(id, guest ? token : undefined))
    }
    return outcome
  }
  return { ...command, run, pending: command.pending || leaving }
}
