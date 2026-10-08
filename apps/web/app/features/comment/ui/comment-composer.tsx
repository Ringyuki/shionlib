import { toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { CommentItem } from '../comment'
import { useCommentEdit } from '../use-comment-edit'
import { useCommentPost } from '../use-comment-post'
import { CommentForm } from './comment-form'

type NewCommentProps = {
  gameId: number
  parent?: Pick<CommentItem, 'id' | 'creator'>
  onDone?: () => void
}

export function NewComment({ gameId, parent, onDone }: NewCommentProps) {
  const t = useTranslations('comment')
  const post = useCommentPost()
  return (
    <CommentForm
      label={parent === undefined ? t('write') : t('replyTo', { name: parent.creator.name })}
      submitLabel={parent === undefined ? t('post') : t('reply')}
      pending={post.pending}
      failure={post.failure}
      onCancel={parent === undefined ? undefined : onDone}
      onSubmit={async content => {
        const outcome = await post.run({ gameId, parentId: parent?.id, content })
        if (outcome.ok) {
          toast.success(t('posted'))
          onDone?.()
        }
        return outcome.ok
      }}
    />
  )
}

type CommentEditorProps = {
  comment: Pick<CommentItem, 'id'>
  source: string
  onDone: () => void
}

export function CommentEditor({ comment, source, onDone }: CommentEditorProps) {
  const t = useTranslations('comment')
  const edit = useCommentEdit()
  return (
    <CommentForm
      label={t('editing')}
      initial={source}
      submitLabel={t('save')}
      pending={edit.pending}
      failure={edit.failure}
      onCancel={onDone}
      onSubmit={async content => {
        const outcome = await edit.run({ commentId: comment.id, content })
        if (outcome.ok) {
          toast.success(t('saved'))
          onDone()
        }
        return outcome.ok
      }}
    />
  )
}
