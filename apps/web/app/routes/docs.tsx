import { DocsPage } from '~/features/docs'
import type { Route } from './+types/docs'

export { docsLoader as loader } from '~/features/docs/docs.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.docs.title} | Shionlib` }]
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  return <DocsPage docs={loaderData.docs} />
}
