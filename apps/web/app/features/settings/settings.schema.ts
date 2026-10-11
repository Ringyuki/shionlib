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

export function nameForm(kit: FormKit) {
  return v.object({ name: kit.text('UpdateNameInputBody', 'name') })
}

export type NameValues = v.InferInput<ReturnType<typeof nameForm>>
