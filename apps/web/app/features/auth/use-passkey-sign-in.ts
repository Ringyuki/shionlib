import { useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { passkeyOptionsAction, passkeySignInAction } from './auth.server'
import { assertPasskey, passkeysSupported } from './webauthn'

export type PasskeyProblem = 'unsupported' | 'cancelled'

export function usePasskeySignIn() {
  const options = useCommand(
    useFetcher<typeof passkeyOptionsAction>(),
    href('/resources/auth/passkey-options'),
  )
  const verify = useCommand(
    useFetcher<typeof passkeySignInAction>(),
    href('/resources/auth/passkey-sign-in'),
  )
  const [problem, setProblem] = useState<PasskeyProblem>()
  const [settledFlow, setSettledFlow] = useState<string>()
  const flow = options.settled?.ok === true ? options.settled.result : undefined
  const submitAssertion = useEffectEvent(verify.run)

  useEffect(() => {
    if (flow === undefined) {
      return
    }
    let active = true
    assertPasskey(flow.options)
      .then(
        credential => {
          if (!active) {
            return
          }
          if (credential === undefined) {
            setProblem('cancelled')
            return
          }
          void submitAssertion({ flowId: flow.flowId, credential: JSON.stringify(credential) })
        },
        () => {
          if (active) {
            setProblem('cancelled')
          }
        },
      )
      .finally(() => {
        if (active) {
          setSettledFlow(flow.flowId)
        }
      })
    return () => {
      active = false
    }
  }, [flow])

  const start = () => {
    setProblem(undefined)
    if (!passkeysSupported()) {
      setProblem('unsupported')
      return
    }
    void options.run({})
  }

  return {
    start,
    pending:
      options.pending || verify.pending || (flow !== undefined && settledFlow !== flow.flowId),
    problem,
  }
}
