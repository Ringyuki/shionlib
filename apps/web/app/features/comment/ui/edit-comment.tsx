import { toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { CommentItem } from '../comment'
import { useCommentEdit } from '../use-comment-edit'
import { CommentComposer } from './comment-composer'

type EditCommentProps = {
  comment: Pick<CommentItem, 'id' | 'content'>
  onDone: () => void
}

export function EditComment({ comment, onDone }: EditCommentProps) {
  const t = useTranslations('comment')
  const edit = useCommentEdit()
  return (
    <CommentComposer
      label={t('editing')}
      hint={t('hint')}
      initial={comment.content}
      submitLabel={t('save')}
      pending={edit.pending}
      refused={edit.refused}
      autoFocus
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
