import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

export type Viewer = Schema<'UserMeDTO'>

export const contentLimits = constraints.UpdateContentLimitInputBody.content_limit.enum

export type ContentLimit = (typeof contentLimits)[number]

const plainContentLimit: ContentLimit = 3

export function showsExplicit(viewer: Pick<Viewer, 'content_limit'> | null): boolean {
  return viewer?.content_limit === plainContentLimit
}

export const languages = constraints.UpdateLangInputBody.lang.enum

export type Language = (typeof languages)[number]

const adminRole = 2

const superAdminRole = 3

type Ranked = Pick<Viewer, 'role'> | null

export function isStaff(viewer: Ranked): boolean {
  return (viewer?.role ?? 0) >= adminRole
}

export function isSuperAdmin(viewer: Ranked): boolean {
  return (viewer?.role ?? 0) >= superAdminRole
}
