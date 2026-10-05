import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import type { Locale } from '~/shared/i18n/locale'
import { remainingSeconds } from './auth'
import type { SignUpValues } from './auth.schema'
import type { signUpAction, signUpCodeAction } from './auth.server'

export function useSignUp(locale: Locale) {
  const code = useFetcher<typeof signUpCodeAction>()
  const account = useFetcher<typeof signUpAction>()
  const [requested, setRequested] = useState<{ email: string; at: number }>()
  const [now, setNow] = useState(() => Date.now())
  const sent = code.state === 'idle' && code.data?.ok === true ? code.data.result : undefined
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
    return code.submit(
      { email },
      { method: 'post', action: href('/resources/auth/sign-up-code'), encType: 'application/json' },
    )
  }

  const submit = (form: SignUpValues) => {
    if (sent === undefined) {
      return Promise.resolve(false)
    }
    return account
      .submit(
        {
          name: form.name,
          email: form.email,
          password: form.password,
          code: form.code,
          codeId: sent.codeId,
          locale,
        },
        { method: 'post', action: href('/resources/auth/sign-up'), encType: 'application/json' },
      )
      .then(() => true)
  }

  return {
    requestCode,
    requesting: code.state !== 'idle',
    codeFailure: code.data?.ok === false ? code.data.failure : undefined,
    sentTo: sent === undefined ? undefined : requested?.email,
    cooldown,
    submit,
    pending: account.state !== 'idle',
    failure: account.data?.ok === false ? account.data.failure : undefined,
  }
}
