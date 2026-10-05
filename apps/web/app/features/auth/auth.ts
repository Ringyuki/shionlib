import { isLocale, type Locale } from '~/shared/i18n/locale'

export type AuthView = 'sign-in' | 'sign-up' | 'forgot-password'

export const authViews: readonly AuthView[] = ['sign-in', 'sign-up', 'forgot-password']

export const authViewParam = 'auth'

export type SignIn = { identifier: string; password: string }

export type SignUp = {
  name: string
  email: string
  password: string
  code: string
  codeId: string
  locale: Locale
}

export type SignUpForm = Omit<SignUp, 'codeId' | 'locale'> & { adult: boolean }

export type EmailOnly = { email: string }

export type PasskeyAssertion = { flowId: string; credential: Record<string, unknown> }

export type PasswordReset = { token: string; email: string; password: string }

export type PasswordResetForm = { password: string; confirmation: string }

export type Issue =
  | 'required'
  | 'email'
  | 'nameLength'
  | 'passwordLength'
  | 'passwordPolicy'
  | 'codeLength'
  | 'adult'
  | 'mismatch'

export type Issues<Form> = Partial<Record<keyof Form, Issue>>

export const codeLength = 6

export const codeResendSeconds = 60

const nameRange = { min: 2, max: 20 }

const passwordRange = { min: 8, max: 50 }

export function isAuthView(value: string | null): value is AuthView {
  return authViews.some(view => view === value)
}

export function parseSignIn(value: unknown): SignIn | undefined {
  const { identifier, password } = record(value)
  if (typeof identifier === 'string' && typeof password === 'string') {
    return { identifier, password }
  }
  return undefined
}

export function parseSignUp(value: unknown): SignUp | undefined {
  const { name, email, password, code, codeId, locale } = record(value)
  if (
    typeof name === 'string' &&
    typeof email === 'string' &&
    typeof password === 'string' &&
    typeof code === 'string' &&
    typeof codeId === 'string' &&
    isLocale(locale)
  ) {
    return { name, email, password, code, codeId, locale }
  }
  return undefined
}

export function parseEmailOnly(value: unknown): EmailOnly | undefined {
  const { email } = record(value)
  return typeof email === 'string' ? { email } : undefined
}

export function parsePasskeyAssertion(value: unknown): PasskeyAssertion | undefined {
  const { flowId, credential } = record(value)
  if (typeof flowId !== 'string' || typeof credential !== 'string') {
    return undefined
  }
  const parsed = parseJson(credential)
  return isRecord(parsed) ? { flowId, credential: parsed } : undefined
}

export function parsePasswordReset(value: unknown): PasswordReset | undefined {
  const { token, email, password } = record(value)
  if (typeof token === 'string' && typeof email === 'string' && typeof password === 'string') {
    return { token, email, password }
  }
  return undefined
}

export function signInIssues(form: SignIn): Issues<SignIn> {
  return compact({
    identifier: form.identifier.trim() === '' ? 'required' : undefined,
    password: form.password === '' ? 'required' : undefined,
  })
}

export function emailIssues(form: EmailOnly): Issues<EmailOnly> {
  return compact({ email: emailIssue(form.email) })
}

export function signUpIssues(form: SignUpForm): Issues<SignUpForm> {
  const nameLength = [...form.name.trim()].length
  return compact({
    name:
      nameLength === 0
        ? 'required'
        : nameLength < nameRange.min || nameLength > nameRange.max
          ? 'nameLength'
          : undefined,
    email: emailIssue(form.email),
    code: /^\d+$/.test(form.code) && form.code.length === codeLength ? undefined : 'codeLength',
    password: passwordIssue(form.password),
    adult: form.adult ? undefined : 'adult',
  })
}

export function passwordResetIssues(form: PasswordResetForm): Issues<PasswordResetForm> {
  return compact({
    password: passwordIssue(form.password),
    confirmation: form.confirmation === form.password ? undefined : 'mismatch',
  })
}

export function meetsPasswordPolicy(password: string): boolean {
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[^A-Za-z_]/.test(password)
}

export function remainingSeconds(sentAt: number | undefined, now: number): number {
  if (sentAt === undefined) {
    return 0
  }
  return Math.max(0, codeResendSeconds - Math.floor((now - sentAt) / 1000))
}

function emailIssue(email: string): Issue | undefined {
  const trimmed = email.trim()
  if (trimmed === '') {
    return 'required'
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? undefined : 'email'
}

function passwordIssue(password: string): Issue | undefined {
  if (password === '') {
    return 'required'
  }
  if (password.length < passwordRange.min || password.length > passwordRange.max) {
    return 'passwordLength'
  }
  return meetsPasswordPolicy(password) ? undefined : 'passwordPolicy'
}

function compact<Form>(issues: { [Key in keyof Form]?: Issue | undefined }): Issues<Form> {
  const result: Issues<Form> = {}
  for (const key in issues) {
    const issue = issues[key]
    if (issue !== undefined) {
      result[key] = issue
    }
  }
  return result
}

function parseJson(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed
  } catch {
    return undefined
  }
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value)) : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
