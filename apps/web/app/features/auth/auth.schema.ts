import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { locales } from '~/shared/i18n/locale'
import { authViews, type AuthView } from './auth'

export type AuthIssue = 'adult' | 'mismatch'

export type AuthIssueMessage = (issue: AuthIssue) => string

export const signInCommand = v.object({ identifier: v.string(), password: v.string() })

export const signUpCommand = v.object({
  name: v.string(),
  email: v.string(),
  password: v.string(),
  code: v.string(),
  codeId: v.string(),
  locale: v.picklist(locales),
})

export const emailCommand = v.object({ email: v.string() })

export const passkeyCredential = v.looseObject({ id: v.string(), response: v.looseObject({}) })

const passkeyRequestOptions = v.looseObject({ challenge: v.string() })

export const passkeyAssertionCommand = v.object({
  flowId: v.string(),
  credential: v.pipe(v.string(), v.parseJson(), passkeyCredential),
})

export const passwordResetCommand = v.object({
  token: v.string(),
  email: v.string(),
  password: v.string(),
})

export type SignIn = v.InferOutput<typeof signInCommand>

export type SignUp = v.InferOutput<typeof signUpCommand>

export type EmailOnly = v.InferOutput<typeof emailCommand>

export type PasskeyAssertion = v.InferOutput<typeof passkeyAssertionCommand>

export type PasskeyCredential = v.InferOutput<typeof passkeyCredential>

export type PasswordReset = v.InferOutput<typeof passwordResetCommand>

export function signInForm(kit: FormKit) {
  return v.object({
    identifier: kit.text('PasswordLoginInputBody', 'identifier'),
    password: kit.text('PasswordLoginInputBody', 'password'),
  })
}

export function signUpForm(kit: FormKit, issue: AuthIssueMessage) {
  return v.object({
    name: kit.text('RegisterUserInputBody', 'name'),
    email: kit.text('RegisterUserInputBody', 'email'),
    code: kit.text('RegisterUserInputBody', 'code'),
    password: kit.text('RegisterUserInputBody', 'password'),
    adult: v.pipe(v.boolean(), v.value(true, issue('adult'))),
  })
}

export function codeRequestForm(kit: FormKit) {
  return v.object({ email: kit.text('RequestCodeInputBody', 'email') })
}

export function forgotPasswordForm(kit: FormKit) {
  return v.object({ email: kit.text('ForgotPasswordInputBody', 'email') })
}

export function passwordResetForm(kit: FormKit, issue: AuthIssueMessage) {
  return v.pipe(
    v.object({
      password: kit.text('ResetPasswordInputBody', 'password'),
      confirmation: v.string(),
    }),
    v.forward(
      v.partialCheck(
        [['password'], ['confirmation']],
        input => input.password === input.confirmation,
        issue('mismatch'),
      ),
      ['confirmation'],
    ),
  )
}

export type SignUpValues = v.InferInput<ReturnType<typeof signUpForm>>

export type PasswordResetValues = v.InferInput<ReturnType<typeof passwordResetForm>>

export function isAuthView(value: unknown): value is AuthView {
  return v.is(v.picklist(authViews), value)
}

export function isPasskeyRequestOptions(
  value: unknown,
): value is PublicKeyCredentialRequestOptionsJSON {
  return v.is(passkeyRequestOptions, value)
}
