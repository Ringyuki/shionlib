import * as v from 'valibot'
import { linkErrorParam, linkedParam, type LinkResult } from './account'
import { passkeyCredential } from '~/features/auth'
import type { FormKit } from '~/shared/form/form-kit'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export type AccountIssue = 'mismatch' | 'currentCodeFirst' | 'newCodeFirst'

export type AccountIssueMessage = (issue: AccountIssue) => string

export const newEmailCodeCommand = v.object({ email: v.string() })

export type NewEmailCode = v.InferOutput<typeof newEmailCodeCommand>

export const emailCommand = v.object({
  email: v.string(),
  currentId: v.string(),
  currentCode: v.string(),
  newId: v.string(),
  newCode: v.string(),
})

export type EmailChange = v.InferOutput<typeof emailCommand>

export const passwordCommand = v.object({ oldPassword: v.string(), password: v.string() })

export type PasswordChange = v.InferOutput<typeof passwordCommand>

export const passkeyStartCommand = v.object({ name: v.string() })

export type PasskeyStart = v.InferOutput<typeof passkeyStartCommand>

export const passkeyFinishCommand = v.object({
  flowId: v.string(),
  name: v.string(),
  credential: v.pipe(v.string(), v.parseJson(), passkeyCredential),
})

export type PasskeyFinish = v.InferOutput<typeof passkeyFinishCommand>

export const removalCommand = v.object({ id })

export type Removal = v.InferOutput<typeof removalCommand>

export const potatoBindingCommand = v.object({ name: v.string(), password: v.string() })

export type PotatoSignIn = v.InferOutput<typeof potatoBindingCommand>

export function newEmailForm(kit: FormKit) {
  return v.object({ email: kit.text('UpdateEmailInputBody', 'email') })
}

export function emailForm(kit: FormKit) {
  return v.object({
    email: kit.text('UpdateEmailInputBody', 'email'),
    currentCode: kit.text('UpdateEmailInputBody', 'currentCode'),
    newCode: kit.text('UpdateEmailInputBody', 'newCode'),
  })
}

export type EmailValues = v.InferInput<ReturnType<typeof emailForm>>

export function passwordForm(kit: FormKit, issue: AccountIssueMessage) {
  return v.pipe(
    v.object({
      oldPassword: kit.text('UpdatePasswordInputBody', 'old_password'),
      password: kit.text('UpdatePasswordInputBody', 'password'),
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

export type PasswordValues = v.InferInput<ReturnType<typeof passwordForm>>

export function passkeyForm(kit: FormKit) {
  return v.object({ name: kit.text('PasskeyRegisterOptionsInputBody', 'name') })
}

export type PasskeyValues = v.InferInput<ReturnType<typeof passkeyForm>>

export function potatoBindingForm(kit: FormKit) {
  return v.object({
    name: kit.text('BindPotatoVNInputBody', 'pvn_user_name'),
    password: kit.text('BindPotatoVNInputBody', 'pvn_password'),
  })
}

export type PotatoBindingValues = v.InferInput<ReturnType<typeof potatoBindingForm>>

export function linkResultFrom(params: URLSearchParams): LinkResult | undefined {
  if (params.has(linkedParam)) {
    return { linked: true, reason: undefined }
  }
  const reason = params.get(linkErrorParam)
  return reason === null ? undefined : { linked: false, reason }
}
