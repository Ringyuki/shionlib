import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { createPasskey, passkeysSupported } from '~/features/auth'
import { useCommand } from '~/shared/route/use-command'
import type { PasskeyProblem } from './account'
import type {
  passkeyFinishAction,
  passkeyRemovalAction,
  passkeyStartAction,
} from './account.server'

export function usePasskeyRegistration() {
  const start = useCommand(
    useFetcher<typeof passkeyStartAction>(),
    href('/resources/account/passkey-start'),
    { revalidate: false },
  )
  const finish = useCommand(
    useFetcher<typeof passkeyFinishAction>(),
    href('/resources/account/passkey-finish'),
  )
  const [problem, setProblem] = useState<PasskeyProblem>()
  const [waiting, setWaiting] = useState(false)
  const register = async (name: string): Promise<boolean> => {
    setProblem(undefined)
    if (!passkeysSupported()) {
      setProblem('unsupported')
      return false
    }
    const flow = await start.run({ name })
    if (!flow.ok) {
      return false
    }
    setWaiting(true)
    const credential = await createPasskey(flow.result.options).catch(() => undefined)
    setWaiting(false)
    if (credential === undefined) {
      setProblem('cancelled')
      return false
    }
    const outcome = await finish.run({
      flowId: flow.result.flowId,
      name,
      credential: JSON.stringify(credential),
    })
    return outcome.ok
  }
  return {
    register,
    problem,
    forget: () => setProblem(undefined),
    pending: start.pending || waiting || finish.pending,
    failure: start.failure ?? finish.failure,
  }
}

export function usePasskeyRemoval() {
  const command = useCommand(
    useFetcher<typeof passkeyRemovalAction>(),
    href('/resources/account/passkey-remove'),
  )
  return { confirm: (id: number) => command.confirm({ id }) }
}
