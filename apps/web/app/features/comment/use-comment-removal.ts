import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CommentRemoval } from './comment.schema'
import type { commentRemovalAction } from './comment.server'

export function useCommentRemoval() {
  const command = useCommand(
    useFetcher<typeof commentRemovalAction>(),
    href('/resources/comments/remove'),
  )
  return { ...command, confirm: (removal: CommentRemoval) => command.confirm(removal) }
}
