import { CommentsPage } from '~/features/admin-comment'
import type { Route } from './+types/admin.comments'
import { pageMeta } from '~/shared/seo/seo'

export { commentsLoader as loader } from '~/features/admin-comment/admin-comment.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminComment.title, indexable: false })
}

export default function AdminComments({ loaderData }: Route.ComponentProps) {
  return <CommentsPage {...loaderData} />
}
