import { InboxPage } from '~/features/message'
import type { Route } from './+types/messages'

export { inboxLoader as loader } from '~/features/message/message.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.message.title} | Shionlib` }]
}

export default function MessagesRoute({ loaderData }: Route.ComponentProps) {
  return <InboxPage inbox={loaderData} />
}
