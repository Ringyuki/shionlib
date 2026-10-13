import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { profileTabs, type ProfileTab } from './profile'

const profileTab = v.picklist(profileTabs)

export function profileTabFrom(value: unknown): ProfileTab | undefined {
  const parsed = v.safeParse(profileTab, value)
  return parsed.success ? parsed.output : undefined
}

export const removed = ''

const picture = v.instance(File)

const removable = v.union([picture, v.literal(removed)])

export const profileEdit = v.object({
  bio: v.optional(v.string()),
  avatar: v.optional(picture),
  cover: v.optional(removable),
  background: v.optional(removable),
})

export type ProfileEdit = v.InferOutput<typeof profileEdit>

export function bioForm(kit: FormKit) {
  return v.object({ bio: kit.text('UpdateBioInputBody', 'bio') })
}

export type BioValues = v.InferInput<ReturnType<typeof bioForm>>
