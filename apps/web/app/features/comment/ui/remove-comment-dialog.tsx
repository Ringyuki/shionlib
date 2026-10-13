import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { CommentItem } from '../comment'
import { useCommentRemoval } from '../use-comment-removal'

type RemoveCommentDialogProps = {
  comment: Pick<CommentItem, 'id' | 'reply_count'> | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RemoveCommentDialog({ comment, open, onOpenChange }: RemoveCommentDialogProps) {
  const t = useTranslations('comment')
  const removal = useCommentRemoval()
  const answered = comment !== undefined && comment.reply_count > 0
  return (
    <AlertDialog
      title={t('removeConfirm')}
      description={t(answered ? 'removeWithReplies' : 'removeDescription')}
      confirmText={t('remove')}
      cancelText={t('cancel')}
      tone="danger"
      open={open && comment !== undefined}
      onOpenChange={onOpenChange}
      onConfirm={async () => {
        if (comment !== undefined) {
          await removal.confirm({ commentId: comment.id })
          toast.success(t('removed'))
        }
      }}
    />
  )
}
