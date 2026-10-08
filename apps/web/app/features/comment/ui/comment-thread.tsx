import { Stack } from '@hina-ui/react'
import { useState } from 'react'
import type { CommentItem, CommentThread as Thread } from '../comment'
import { NewComment } from './comment-composer'
import { CommentEntry } from './comment-entry'

type CommentThreadProps = {
  gameId: number
  thread: Thread
  viewerId: number | undefined
  onRemove: (comment: CommentItem) => void
}

export function CommentThread({ gameId, thread, viewerId, onRemove }: CommentThreadProps) {
  const [answered, setAnswered] = useState<CommentItem | undefined>(undefined)
  const replies = thread.replies ?? []
  return (
    <CommentEntry
      comment={thread}
      own={thread.creator.id === viewerId}
      onReply={() => setAnswered(thread)}
      onRemove={onRemove}
    >
      {(replies.length > 0 || answered !== undefined) && (
        <Stack gap="lg" className="pt-3">
          {replies.map(reply => (
            <CommentEntry
              key={reply.id}
              comment={reply}
              own={reply.creator.id === viewerId}
              answering
              onReply={() => setAnswered(reply)}
              onRemove={onRemove}
            />
          ))}
          {answered !== undefined && (
            <NewComment
              key={answered.id}
              gameId={gameId}
              parent={answered}
              onDone={() => setAnswered(undefined)}
            />
          )}
        </Stack>
      )}
    </CommentEntry>
  )
}
