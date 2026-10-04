import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import type { passkeyOptionsAction, passkeySignInAction } from './auth.server'
import { assertPasskey, passkeysSupported } from './webauthn'

export type PasskeyProblem = 'unsupported' | 'cancelled'

export function usePasskeySignIn() {
  const options = useFetcher<typeof passkeyOptionsAction>()
  const verify = useFetcher<typeof passkeySignInAction>()
  const [problem, setProblem] = useState<PasskeyProblem>()
  const [settledFlow, setSettledFlow] = useState<string>()
  const flow = options.data?.ok === true ? options.data.result : undefined
  const submitAssertion = verify.submit

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
          void submitAssertion(
            { flowId: flow.flowId, credential: JSON.stringify(credential) },
            {
              method: 'post',
              action: href('/resources/auth/passkey-sign-in'),
              encType: 'application/json',
            },
          )
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
  }, [flow, submitAssertion])

  const start = () => {
    setProblem(undefined)
    if (!passkeysSupported()) {
      setProblem('unsupported')
      return
    }
    void options.submit(
      {},
      {
        method: 'post',
        action: href('/resources/auth/passkey-options'),
        encType: 'application/json',
      },
    )
  }

  const failure =
    verify.data?.ok === false
      ? verify.data.failure
      : options.data?.ok === false
        ? options.data.failure
        : undefined

  return {
    start,
    pending:
      options.state !== 'idle' ||
      verify.state !== 'idle' ||
      (flow !== undefined && settledFlow !== flow.flowId),
    problem,
    failure,
  }
}
