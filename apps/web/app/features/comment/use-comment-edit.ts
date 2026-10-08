import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CommentEdit } from './comment.schema'
import type { commentEditAction } from './comment.server'

export function useCommentEdit() {
  const command = useCommand(
    useFetcher<typeof commentEditAction>(),
    href('/resources/comments/edit'),
  )
  return { ...command, run: (edit: CommentEdit) => command.run(edit) }
}
