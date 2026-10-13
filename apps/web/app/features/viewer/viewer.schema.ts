import * as v from 'valibot'
import { contentLimits, languages, type ContentLimit } from './viewer'

export const preferenceCommand = v.object({
  lang: v.optional(v.picklist(languages)),
  contentLimit: v.optional(v.picklist(contentLimits)),
  onlyGamesWithResources: v.optional(v.boolean()),
  showProfileBackgrounds: v.optional(v.boolean()),
})

export type PreferenceChange = v.InferOutput<typeof preferenceCommand>

const contentLimit = v.picklist(contentLimits)

export function contentLimitFrom(value: unknown): ContentLimit | undefined {
  const parsed = v.safeParse(contentLimit, value)
  return parsed.success ? parsed.output : undefined
}
