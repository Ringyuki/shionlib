import { adPage } from '~/features/ad'
import { DeveloperPage, developerHead } from '~/features/developer'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/developer'

export const handle = adPage

export { developerLoader as loader } from '~/features/developer/developer.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && developerHead(args.loaderData, lang.loaderData))
}

export default function DeveloperRoute({ loaderData }: Route.ComponentProps) {
  return <DeveloperPage content={loaderData} />
}
