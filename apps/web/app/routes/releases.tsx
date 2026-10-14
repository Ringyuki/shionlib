import { ReleasesPage } from '~/features/release'
import type { Route } from './+types/releases'
import { pageMeta } from '~/shared/seo/seo'

export { releasesLoader as loader } from '~/features/release/release.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.release.title })
}

export default function ReleasesRoute({ loaderData }: Route.ComponentProps) {
  return <ReleasesPage releases={loaderData} />
}
