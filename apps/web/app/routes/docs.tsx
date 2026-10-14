import { DocsPage } from '~/features/docs'
import type { Route } from './+types/docs'
import { pageMeta } from '~/shared/seo/seo'

export { docsLoader as loader } from '~/features/docs/docs.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.docs.title })
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  return <DocsPage docs={loaderData.docs} />
}
