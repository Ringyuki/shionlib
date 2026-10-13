import * as v from 'valibot'
import { isBlank } from '~/shared/richtext/rich-text'
import { richDocument } from '~/shared/richtext/rich-text.schema'
import { firstOrder, threadOrders, type ThreadOrder } from './comment'

export type CommentIssue = 'empty'

export type CommentIssueMessage = (issue: CommentIssue) => string

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const place = v.object({ kind: v.picklist(['game', 'resource']), id })

export const commentPostCommand = v.object({
  place,
  parentId: v.optional(id),
  content: richDocument,
})

export type CommentPost = v.InferOutput<typeof commentPostCommand>

export const commentEditCommand = v.object({ commentId: id, content: richDocument })

export type CommentEdit = v.InferOutput<typeof commentEditCommand>

export const commentRemovalCommand = v.object({ commentId: id })

export type CommentRemoval = v.InferOutput<typeof commentRemovalCommand>

export const commentLikeCommand = v.object({ commentId: id })

export type CommentLike = v.InferOutput<typeof commentLikeCommand>

export const commentPinCommand = v.object({ commentId: id, pinned: v.boolean() })

export type CommentPin = v.InferOutput<typeof commentPinCommand>

export function commentForm(issue: CommentIssueMessage) {
  return v.object({
    content: v.pipe(
      richDocument,
      v.check(document => !isBlank(document), issue('empty')),
    ),
  })
}

export type CommentValues = v.InferInput<ReturnType<typeof commentForm>>

const focus = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))),
  undefined,
)

export function focusFrom(raw: string | null): number | undefined {
  return v.parse(focus, raw ?? undefined)
}

const threadOrder = v.fallback(v.picklist(threadOrders), firstOrder)

export function threadOrderFrom(raw: unknown): ThreadOrder {
  return v.parse(threadOrder, raw)
}
