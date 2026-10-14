import { CommentsView } from '~/features/comment'
import { resourceHead } from '~/features/resource'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/resource.comments'

export { resourceCommentsLoader as loader } from '~/features/comment/comment.server'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , resource] = args.matches
  return pageMeta(args, resourceHead(resource.loaderData, lang.loaderData, 'comments'))
}

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
