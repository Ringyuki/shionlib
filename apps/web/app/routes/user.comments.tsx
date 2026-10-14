import { UserCommentList } from '~/features/comment'
import { profileHead } from '~/features/profile'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/user.comments'

export { userCommentsLoader as loader } from '~/features/comment/comment.server'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , user] = args.matches
  return pageMeta(args, profileHead(user.loaderData.profile, lang.loaderData, 'comments'))
}

export default function UserCommentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , user] = matches
  return (
    <UserCommentList
      comments={loaderData}
      own={site.loaderData.viewer?.id === user.loaderData.profile.id}
    />
  )
}
