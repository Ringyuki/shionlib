import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import type { Locale } from '~/shared/i18n/locale'
import { useCommand } from '~/shared/route/use-command'
import { remainingSeconds } from './auth'
import type { SignUpValues } from './auth.schema'
import type { signUpAction, signUpCodeAction } from './auth.server'

export function useSignUp(locale: Locale) {
  const code = useCommand(
    useFetcher<typeof signUpCodeAction>(),
    href('/resources/auth/sign-up-code'),
  )
  const account = useCommand(useFetcher<typeof signUpAction>(), href('/resources/auth/sign-up'))
  const [requested, setRequested] = useState<{ email: string; at: number }>()
  const [now, setNow] = useState(() => Date.now())
  const sent = code.settled?.ok === true ? code.settled.result : undefined
  const cooldown = sent === undefined ? 0 : remainingSeconds(requested?.at, now)
  const counting = cooldown > 0

  useEffect(() => {
    if (!counting) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [counting])

  const requestCode = (email: string) => {
    const at = Date.now()
    setRequested({ email: email.trim(), at })
    setNow(at)
    return code.run({ email })
  }

  const run = (form: SignUpValues) => {
    if (sent === undefined) {
      return Promise.resolve(undefined)
    }
    return account.run({
      name: form.name,
      email: form.email,
      password: form.password,
      code: form.code,
      codeId: sent.codeId,
      locale,
    })
  }

  return {
    requestCode,
    requesting: code.pending,
    codeFailure: code.failure,
    sentTo: sent === undefined ? undefined : requested?.email,
    cooldown,
    run,
    pending: account.pending,
    failure: account.failure,
  }
}
