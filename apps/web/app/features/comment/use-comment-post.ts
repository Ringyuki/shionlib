import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CommentPost } from './comment.schema'
import type { commentPostAction } from './comment.server'

export function useCommentPost() {
  const command = useCommand(useFetcher<typeof commentPostAction>(), href('/resources/comments'))
  return { ...command, run: (post: CommentPost) => command.run(post) }
}
