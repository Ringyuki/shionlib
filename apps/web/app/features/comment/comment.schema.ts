import * as v from 'valibot'
import { firstOrder, threadOrders, type ThreadOrder } from './comment'

export type CommentIssue = 'empty'

export type CommentIssueMessage = (issue: CommentIssue) => string

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const commentPostCommand = v.object({
  gameId: id,
  parentId: v.optional(id),
  content: v.string(),
})

export type CommentPost = v.InferOutput<typeof commentPostCommand>

export const commentEditCommand = v.object({ commentId: id, content: v.string() })

export type CommentEdit = v.InferOutput<typeof commentEditCommand>

export const commentRemovalCommand = v.object({ commentId: id })

export type CommentRemoval = v.InferOutput<typeof commentRemovalCommand>

export const commentLikeCommand = v.object({ commentId: id })

export type CommentLike = v.InferOutput<typeof commentLikeCommand>

export function commentForm(issue: CommentIssueMessage) {
  return v.object({ content: v.pipe(v.string(), v.trim(), v.minLength(1, issue('empty'))) })
}

export type CommentValues = v.InferInput<ReturnType<typeof commentForm>>

const threadOrder = v.fallback(v.picklist(threadOrders), firstOrder)

export function threadOrderFrom(raw: unknown): ThreadOrder {
  return v.parse(threadOrder, raw)
}
