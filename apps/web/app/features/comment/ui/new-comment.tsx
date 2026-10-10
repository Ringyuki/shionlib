import { Avatar, cn, Inline, toast, useImageResolver } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { CommentItem, Writer } from '../comment'
import { useCommentPost } from '../use-comment-post'
import { CommentComposer } from './comment-composer'

type NewCommentProps = {
  gameId: number
  writer: Writer
  parent?: Pick<CommentItem, 'id' | 'creator'>
  autoFocus?: boolean
  onDone?: () => void
}

export function NewComment({ gameId, writer, parent, autoFocus = false, onDone }: NewCommentProps) {
  const t = useTranslations('comment')
  const resolveImage = useImageResolver()
  const comment = useCommentPost(gameId, parent?.id)
  const answering = parent !== undefined
  return (
    <Inline gap="md" align="start" wrap={false} className={answering ? 'gap-2.5' : undefined}>
      <Avatar
        size={answering ? 'sm' : 'md'}
        name={writer.name}
        src={writer.avatar === null ? undefined : resolveImage(writer.avatar, 'image')}
        className={cn('mt-1.5 shrink-0 sm:mt-1', answering ? 'sm:size-7' : 'sm:size-9')}
      />
      <CommentComposer
        label={answering ? t('replyTo', { name: parent.creator.name }) : t('field')}
        hint={answering ? t('replyTo', { name: parent.creator.name }) : t('hint')}
        submitLabel={answering ? t('reply') : t('post')}
        pending={comment.pending}
        refused={comment.refused}
        collapsible={!answering}
        autoFocus={answering || autoFocus}
        onCancel={onDone}
        onSubmit={async content => {
          const posted = await comment.post(content)
          if (posted) {
            toast.success(t('posted'))
            onDone?.()
          }
          return posted
        }}
      />
    </Inline>
  )
}
