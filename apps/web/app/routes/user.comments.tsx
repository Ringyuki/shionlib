import { UserCommentList } from '~/features/comment'
import type { Route } from './+types/user.comments'

export { userCommentsLoader as loader } from '~/features/comment/comment.server'

export default function UserCommentsRoute({ loaderData }: Route.ComponentProps) {
  return <UserCommentList comments={loaderData} />
}
