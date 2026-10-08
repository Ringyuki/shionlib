import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

export type WalkthroughIssue = 'empty'

export type WalkthroughIssueMessage = (issue: WalkthroughIssue) => string

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const walkthroughSaveCommand = v.object({
  gameId: id,
  walkthroughId: v.optional(id),
  title: v.string(),
  content: v.string(),
  publish: v.boolean(),
})

export type WalkthroughSave = v.InferOutput<typeof walkthroughSaveCommand>

export const walkthroughRemovalCommand = v.object({ walkthroughId: id })

export type WalkthroughRemoval = v.InferOutput<typeof walkthroughRemovalCommand>

export function walkthroughForm(kit: FormKit, issue: WalkthroughIssueMessage) {
  return v.object({
    title: kit.text('CreateWalkthroughInputBody', 'title'),
    content: v.pipe(v.string(), v.trim(), v.minLength(1, issue('empty'))),
  })
}

export type WalkthroughValues = v.InferInput<ReturnType<typeof walkthroughForm>>
