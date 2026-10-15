import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { placements } from './walkthrough-format'

export const walkthroughFormatCommand = v.object({
  gameId: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  text: v.string(),
})

export type WalkthroughFormat = v.InferOutput<typeof walkthroughFormatCommand>

const task = v.pipe(v.string(), v.uuid())

export function formatTaskFrom(raw: string | undefined): string | undefined {
  const parsed = v.safeParse(task, raw)
  return parsed.success ? parsed.output : undefined
}

export function formatForm(kit: FormKit) {
  return v.object({
    text: kit.text('FormatWalkthroughInputBody', 'text'),
    placement: v.picklist(placements),
  })
}

export type FormatValues = v.InferInput<ReturnType<typeof formatForm>>
