import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CommentChange } from './admin-comment.schema'
import type { commentAction } from './admin-comment.server'

export function useCommentChange() {
  const command = useCommand(useFetcher<typeof commentAction>(), href('/resources/admin/comments'))
  return {
    ...command,
    run: (change: CommentChange) => command.run(change),
    confirm: (change: CommentChange) => command.confirm(change),
  }
}
