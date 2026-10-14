import { WallPage } from '~/features/sponsor'
import type { Route } from './+types/sponsor'
import { pageMeta } from '~/shared/seo/seo'

export { wallLoader as loader } from '~/features/sponsor/sponsor.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.sponsor.title })
}

export default function SponsorRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <WallPage wall={loaderData} viewer={site.loaderData.viewer} />
}
