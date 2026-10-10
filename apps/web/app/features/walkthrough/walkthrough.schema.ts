import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { isBlank } from '~/shared/richtext/rich-text'
import { richDocument } from '~/shared/richtext/rich-text.schema'
import { shelves, type Shelf } from './walkthrough'

export type WalkthroughIssue = 'title' | 'content'

export type WalkthroughIssueMessage = (issue: WalkthroughIssue) => string

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const walkthroughSaveCommand = v.object({
  gameId: id,
  walkthroughId: v.optional(id),
  title: v.string(),
  content: richDocument,
  publish: v.boolean(),
})

export type WalkthroughSave = v.InferOutput<typeof walkthroughSaveCommand>

export const walkthroughPublishCommand = v.object({ walkthroughId: id })

export type WalkthroughPublish = v.InferOutput<typeof walkthroughPublishCommand>

export const walkthroughRemovalCommand = v.object({ walkthroughId: id })

export type WalkthroughRemoval = v.InferOutput<typeof walkthroughRemovalCommand>

export function walkthroughForm(kit: FormKit, issue: WalkthroughIssueMessage) {
  return v.object({
    title: v.pipe(
      v.string(),
      v.check(title => title.trim() !== '', issue('title')),
      kit.text('CreateWalkthroughInputBody', 'title'),
    ),
    content: v.pipe(
      richDocument,
      v.check(document => !isBlank(document), issue('content')),
    ),
  })
}

export type WalkthroughValues = v.InferInput<ReturnType<typeof walkthroughForm>>

export function firstInvalid(
  form: ReturnType<typeof walkthroughForm>,
  values: WalkthroughValues,
): keyof WalkthroughValues | undefined {
  const parsed = v.safeParse(form, values)
  const field = parsed.success ? undefined : parsed.issues[0]?.path?.[0]?.key
  return field === 'title' || field === 'content' ? field : undefined
}

const shelf = v.fallback(v.picklist(shelves), 'all')

export function shelfFrom(raw: unknown): Shelf {
  return v.parse(shelf, raw)
}
