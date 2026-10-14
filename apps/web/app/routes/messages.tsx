import { InboxPage } from '~/features/message'
import type { Route } from './+types/messages'
import { pageMeta } from '~/shared/seo/seo'

export { inboxLoader as loader } from '~/features/message/message.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.message.title, indexable: false })
}

export default function MessagesRoute({ loaderData }: Route.ComponentProps) {
  return <InboxPage inbox={loaderData} />
}
