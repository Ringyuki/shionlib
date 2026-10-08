import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

export type Viewer = Schema<'UserMeDTO'>

export const contentLimits = constraints.UpdateContentLimitInputBody.content_limit.enum

export type ContentLimit = (typeof contentLimits)[number]

export const languages = constraints.UpdateLangInputBody.lang.enum

export type Language = (typeof languages)[number]
