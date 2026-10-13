import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CommentPin } from './comment.schema'
import type { commentPinAction } from './comment.server'

export function useCommentPin() {
  const command = useCommand(useFetcher<typeof commentPinAction>(), href('/resources/comments/pin'))
  return {
    pending: command.pending,
    run: (pin: CommentPin) => command.run(pin),
    confirm: (pin: CommentPin) => command.confirm(pin),
  }
}
