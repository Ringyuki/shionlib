import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  contentLimits,
  defaultSort,
  languages,
  maxQueryLength,
  roles,
  sorts,
  statuses,
  type ContentLimit,
  type Filter,
  type Language,
  type Role,
} from './admin-user'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const numberText = v.pipe(v.string(), v.toNumber())

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const role = v.fallback(v.optional(v.pipe(numberText, v.picklist(roles))), undefined)

const status = v.fallback(v.optional(v.pipe(numberText, v.picklist(statuses))), undefined)

const sort = v.fallback(v.picklist(sorts), defaultSort)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    query: v.parse(query, search.get('q') ?? ''),
    role: v.parse(role, search.get('role') ?? undefined),
    status: v.parse(status, search.get('status') ?? undefined),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    page,
  }
}

export function roleFrom(raw: number): Role | undefined {
  const parsed = v.safeParse(v.picklist(roles), raw)
  return parsed.success ? parsed.output : undefined
}

export function contentLimitFrom(raw: number): ContentLimit | undefined {
  const parsed = v.safeParse(v.picklist(contentLimits), raw)
  return parsed.success ? parsed.output : undefined
}

export function languageFrom(raw: string): Language | undefined {
  const parsed = v.safeParse(v.picklist(languages), raw)
  return parsed.success ? parsed.output : undefined
}

const profile = v.object({
  name: v.string(),
  email: v.string(),
  language: v.picklist(languages),
  contentLimit: v.picklist(contentLimits),
})

export type ProfileValues = v.InferOutput<typeof profile>

const banTerm = v.object({
  days: v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
  reason: v.string(),
  removeComments: v.boolean(),
})

export const userCommand = v.variant('action', [
  v.object({ action: v.literal('profile'), id, ...profile.entries }),
  v.object({ action: v.literal('ban'), id, ...banTerm.entries }),
  v.object({ action: v.literal('unban'), id }),
  v.object({ action: v.literal('password'), id, password: v.string() }),
  v.object({ action: v.literal('logout'), id }),
  v.object({ action: v.literal('trust'), id, trusted: v.boolean() }),
  v.object({ action: v.literal('role'), id, role: v.picklist(roles) }),
  v.object({ action: v.literal('badge'), id, until: v.nullable(v.string()) }),
])

export type UserChange = v.InferOutput<typeof userCommand>

export function profileForm(kit: FormKit) {
  return v.object({
    name: kit.text('AdminUserProfileInputBody', 'name'),
    email: kit.text('AdminUserProfileInputBody', 'email'),
    language: v.picklist(languages),
    contentLimit: v.picklist(contentLimits),
  })
}

export type UserIssue = 'days' | 'reason' | 'until'

export type UserIssueMessage = (issue: UserIssue) => string

export type BanValues = {
  choice: string
  days: number | null
  reason: string
  removeComments: boolean
}

export const maxBanDays = 999

export function banForm(kit: FormKit, issue: UserIssueMessage) {
  return v.object({
    choice: v.string(),
    days: v.nullable(
      v.pipe(
        v.number(issue('days')),
        v.safeInteger(issue('days')),
        v.minValue(1, issue('days')),
        v.maxValue(maxBanDays, issue('days')),
      ),
    ),
    reason: v.pipe(kit.text('AdminUserBanInputBody', 'banned_reason'), v.nonEmpty(issue('reason'))),
    removeComments: v.boolean(),
  })
}

export function passwordForm(kit: FormKit) {
  return v.object({ password: kit.text('AdminUserPasswordInputBody', 'password') })
}
