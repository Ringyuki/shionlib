import { CommentsView } from '~/features/comment'
import type { Route } from './+types/resource.comments'

export { resourceCommentsLoader as loader } from '~/features/comment/comment.server'

export default function ResourceCommentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , resource] = matches
  return (
    <CommentsView
      comments={loaderData}
      writer={site.loaderData.viewer ?? undefined}
      publisherId={resource.loaderData.resource.creator.id}
    />
  )
}
