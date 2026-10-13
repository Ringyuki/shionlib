import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import type { Locale } from '~/shared/i18n/locale'
import { useCommand } from '~/shared/route/use-command'
import type { SignUpValues } from './auth.schema'
import type { signUpAction, signUpCodeAction } from './auth.server'
import { useCodeCooldown } from './use-code-cooldown'

export function useSignUp(locale: Locale) {
  const code = useCommand(
    useFetcher<typeof signUpCodeAction>(),
    href('/resources/auth/sign-up-code'),
  )
  const account = useCommand(useFetcher<typeof signUpAction>(), href('/resources/auth/sign-up'))
  const [requested, setRequested] = useState<string>()
  const resend = useCodeCooldown()
  const sent = code.settled?.ok === true ? code.settled.result : undefined
  const cooldown = sent === undefined ? 0 : resend.cooldown

  const requestCode = (email: string) => {
    setRequested(email.trim())
    resend.start()
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
    sentTo: sent === undefined ? undefined : requested,
    cooldown,
    run,
    pending: account.pending,
    failure: account.failure,
  }
}
