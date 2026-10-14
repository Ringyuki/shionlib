import { DevelopersPage } from '~/features/developer'
import type { Route } from './+types/developers'
import { pageMeta } from '~/shared/seo/seo'

export { developersLoader as loader } from '~/features/developer/developer.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.developer.title })
}

export default function DevelopersRoute({ loaderData }: Route.ComponentProps) {
  return <DevelopersPage developers={loaderData} />
}
