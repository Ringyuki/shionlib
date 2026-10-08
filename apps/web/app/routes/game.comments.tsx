import { CommentsView } from '~/features/comment'
import type { Route } from './+types/game.comments'

export { commentsLoader as loader } from '~/features/comment/comment.server'

export default function GameCommentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <CommentsView comments={loaderData} viewerId={site.loaderData.viewer?.id} />
}
