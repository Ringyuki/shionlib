import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { sections, type Section } from './settings'

const section = v.picklist(sections)

export function sectionFrom(value: unknown): Section | undefined {
  const parsed = v.safeParse(section, value)
  return parsed.success ? parsed.output : undefined
}

export const nameCommand = v.object({ name: v.string() })

export type NameChange = v.InferOutput<typeof nameCommand>

export const bioCommand = v.object({ bio: v.string() })

export type BioChange = v.InferOutput<typeof bioCommand>

export function nameForm(kit: FormKit) {
  return v.object({ name: kit.text('UpdateNameInputBody', 'name') })
}

export type NameValues = v.InferInput<ReturnType<typeof nameForm>>

export function bioForm(kit: FormKit) {
  return v.object({ bio: kit.text('UpdateBioInputBody', 'bio') })
}

export type BioValues = v.InferInput<ReturnType<typeof bioForm>>
