import { CommentsPage } from '~/features/admin-comment'
import type { Route } from './+types/admin.comments'

export { commentsLoader as loader } from '~/features/admin-comment/admin-comment.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminComment.title} | Shionlib` }]
}

export default function AdminComments({ loaderData }: Route.ComponentProps) {
  return <CommentsPage {...loaderData} />
}
