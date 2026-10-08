import { UserCommentList } from '~/features/comment'
import type { Route } from './+types/user.comments'

export { userCommentsLoader as loader } from '~/features/comment/comment.server'

export default function UserCommentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , user] = matches
  return (
    <UserCommentList
      comments={loaderData}
      own={site.loaderData.viewer?.id === user.loaderData.profile.id}
    />
  )
}
