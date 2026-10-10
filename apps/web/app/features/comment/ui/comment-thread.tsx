import { cn, Collapsible, CollapsibleContent, CollapsibleTrigger, Stack } from '@hina-ui/react'
import { Fragment, memo, useCallback, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { holdInPlace, startsInView } from '~/shared/ui/hold-in-place'
import {
  aimsAt,
  repliesShownFirst,
  type CommentItem,
  type CommentThread as Thread,
  type Writer,
} from '../comment'
import { useAimedHash } from '../use-comment-focus'
import { CommentEntry } from './comment-entry'
import { NewComment } from './new-comment'
import { ReplyBox } from './reply-box'
import { openedAtOnce, shownWhileOpening } from './thread-motion'

type CommentThreadProps = {
  gameId: number
  thread: Thread
  writer: Writer | undefined
  onRemove: (comment: CommentItem) => void
}

export const CommentThread = memo(function CommentThread({
  gameId,
  thread,
  writer,
  onRemove,
}: CommentThreadProps) {
  const t = useTranslations('comment')
  const hash = useAimedHash()
  const [answered, setAnswered] = useState<number | undefined>(undefined)
  const [chosen, setChosen] = useState<boolean | undefined>(undefined)
  const fold = useRef<HTMLElement>(null)
  const folded = useRef<HTMLElement>(null)
  const more = useRef<HTMLButtonElement>(null)
  const replies = thread.replies ?? []
  const rest = replies.slice(repliesShownFirst)
  const unfolded = chosen ?? rest.some(reply => aimsAt(hash, reply.id))
  const followed = replies.length > 0
  const answer = useCallback(
    (comment: CommentItem) =>
      setAnswered(current => (current === comment.id ? undefined : comment.id)),
    [],
  )
  const unfold = (next: boolean) => {
    const start = fold.current
    const answers = folded.current
    const button = more.current
    if (start !== null && answers !== null && button !== null) {
      holdInPlace(next || startsInView(start) ? start : button, answers)
    }
    setChosen(next)
  }
  const box = (comment: CommentItem, className: string) =>
    writer !== undefined && (
      <ReplyBox open={answered === comment.id} className={className}>
        <NewComment
          gameId={gameId}
          writer={writer}
          parent={comment}
          onDone={() => setAnswered(undefined)}
        />
      </ReplyBox>
    )
  const row = (reply: CommentItem) => (
    <Fragment key={reply.id}>
      <CommentEntry
        comment={reply}
        own={reply.creator.id === writer?.id}
        nested
        answered={reply.parent_id === thread.id ? undefined : reply.parent.creator?.name}
        replying={answered === reply.id}
        onReply={answer}
        onRemove={onRemove}
      />
      {box(reply, 'py-2')}
    </Fragment>
  )
  return (
    <CommentEntry
      comment={thread}
      own={thread.creator.id === writer?.id}
      replying={answered === thread.id}
      onReply={answer}
      onRemove={onRemove}
    >
      <Stack gap="none" className={followed ? 'pt-1' : 'pt-2'}>
        {box(thread, followed ? 'py-2' : 'pt-1 pb-2')}
        {replies.slice(0, repliesShownFirst).map(row)}
        {rest.length > 0 && (
          <Collapsible ref={fold} open={unfolded} onOpenChange={unfold} className="flex flex-col">
            <CollapsibleContent
              ref={folded}
              className={cn('-mx-2 px-2', shownWhileOpening, chosen === undefined && openedAtOnce)}
            >
              {rest.map(row)}
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <Button
                ref={more}
                size="sm"
                variant="ghost"
                tone="accent"
                className="my-2 -ms-2 self-start"
              >
                {unfolded ? t('foldReplies') : t('moreReplies', { count: rest.length })}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </Stack>
    </CommentEntry>
  )
})
