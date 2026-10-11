import { href, useFetcher, useLocation } from 'react-router'
import { refusedOf } from '~/shared/route/refusal'
import { useCommand } from '~/shared/route/use-command'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { searchFocusing, type CommentPlace } from './comment'
import type { CommentPost } from './comment.schema'
import type { commentPostAction } from './comment.server'

export function useCommentPost(place: CommentPlace, parentId?: number) {
  const stay = useInPageNavigate()
  const location = useLocation()
  const command = useCommand(useFetcher<typeof commentPostAction>(), href('/resources/comments'), {
    quiet: true,
  })
  const post = async (content: RichDocument) => {
    const sent: CommentPost = { place, parentId, content }
    const outcome = await command.run(sent)
    if (outcome.ok) {
      stay({ search: searchFocusing(location.search, outcome.result) }, { replace: true })
    }
    return outcome.ok
  }
  return { post, pending: command.pending, refused: refusedOf(command.settled) }
}
