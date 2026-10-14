import { CommentsView } from '~/features/comment'
import { gameHead } from '~/features/game'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/game.comments'

export { commentsLoader as loader } from '~/features/comment/comment.server'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , game] = args.matches
  return pageMeta(args, gameHead(game.loaderData, lang.loaderData, 'comments'))
}

export default function GameCommentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <CommentsView comments={loaderData} writer={site.loaderData.viewer ?? undefined} />
}
